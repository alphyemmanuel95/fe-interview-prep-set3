import {
  useEffect,
  useMemo,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { assertNever } from '../../../shared/assertNever';
import { isToggleTarget, rowIdOf } from './treeDom';
import { getTreeKeyAction, type TreeKeyAction } from './treeNavigation';
import { TreeErrorRow, TreeItemRow } from './TreeRow';
import { loadAnnouncement } from './loadAnnouncement';
import { useChildrenLoader, type LoadChildren } from './useChildrenLoader';
import { useRovingFocus } from './useRovingFocus';
import { ancestorIdsOf, flattenVisibleRows, type TreeFilter } from './visibleRows';
import './Tree.css';

// Generic over the item type: nothing here knows about files. Callers describe their data through
// accessor functions, which must be referentially stable (module scope or `useCallback`).
export type TreeProps<T> = Readonly<{
  label: string;
  rootItems: readonly T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  isBranch: (item: T) => boolean;
  loadChildren: LoadChildren<T>;
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  onExpandedChange: (id: string, isExpanded: boolean) => void;
  /** Receives the selected row's ancestors (outermost first), so callers can keep it reachable. */
  onSelect: (id: string, ancestorIds: readonly string[]) => void;
  /** Restricts rendering to search matches and their ancestors; see `TreeFilter`. */
  filter?: TreeFilter | undefined;
  renderIcon?: (item: T, isExpanded: boolean) => ReactNode;
  renderLabel?: (item: T) => ReactNode;
}>;

export function Tree<T>(props: TreeProps<T>): JSX.Element {
  const { rootItems, getId, getLabel, isBranch, expandedIds, selectedId, filter } = props;
  const { onExpandedChange, onSelect } = props;
  const { childrenById, load } = useChildrenLoader(props.loadChildren, getId);

  const rows = useMemo(
    () =>
      flattenVisibleRows({
        rootItems,
        accessors: { getId, getLabel, isBranch },
        expandedIds,
        childrenById,
        filter,
      }),
    [rootItems, getId, getLabel, isBranch, expandedIds, childrenById, filter],
  );
  const indexById = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows]);
  const rowById = (id: string) => rows[indexById.get(id) ?? -1];
  const { tabStopId, registerRow, focusRow, handleFocus, handleBlur } = useRovingFocus(
    rows,
    indexById,
    selectedId,
  );

  // The single place children are requested. Expanding by click, key, shared link or browser
  // back/forward all just change `expandedIds`; any expanded branch never requested gets loaded.
  // The cache dedupes, so re-running this (StrictMode, unrelated renders) never refetches.
  useEffect(() => {
    for (const row of rows) {
      if (row.kind === 'item' && row.isExpanded && row.loadStatus === 'idle') {
        load(row.item);
      }
    }
  }, [rows, load]);

  const activate = (id: string): void => {
    const row = rowById(id);
    if (row?.kind === 'error') {
      // Retrying replaces this row; move focus to the folder first so it is not dropped on <body>.
      focusRow(row.parentId);
      load(row.parent);
    } else if (row !== undefined) {
      onSelect(id, ancestorIdsOf(rows, indexById, id));
    }
  };

  const runAction = (action: TreeKeyAction): void => {
    switch (action.type) {
      case 'focus':
        focusRow(action.id);
        return;
      case 'expand':
      case 'collapse':
        onExpandedChange(action.id, action.type === 'expand');
        return;
      case 'activate':
        activate(action.id);
        return;
      case 'none':
        return;
      default:
        assertNever(action);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Leave shortcuts alone: Alt+Left/Right is browser Back/Forward, which this tree relies on.
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const activeIndex = tabStopId === null ? -1 : (indexById.get(tabStopId) ?? -1);
    const action = getTreeKeyAction(rows, activeIndex, event.key);
    if (action !== null) {
      event.preventDefault();
      runAction(action);
    }
  };

  // One delegated listener instead of ~1,000 per-row handlers; it also keeps row props stable.
  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    const id = rowIdOf(event.target);
    const row = id === undefined ? undefined : rowById(id);
    if (row?.kind === 'item' && row.isBranch && isToggleTarget(event.target)) {
      onExpandedChange(row.id, !row.isExpanded);
    } else if (row !== undefined) {
      activate(row.id);
    }
  };

  return (
    <div className="tree">
      <div
        role="tree"
        aria-label={props.label}
        className="tree__list"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {rows.map((row) =>
          row.kind === 'item' ? (
            <TreeItemRow
              key={row.id}
              {...row}
              isSelected={row.id === selectedId}
              isTabStop={row.id === tabStopId}
              getLabel={getLabel}
              renderIcon={props.renderIcon}
              renderLabel={props.renderLabel}
              registerRow={registerRow}
            />
          ) : (
            <TreeErrorRow
              key={row.id}
              id={row.id}
              level={row.level}
              message={row.message}
              isTabStop={row.id === tabStopId}
              registerRow={registerRow}
            />
          ),
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {loadAnnouncement(rows, childrenById, getLabel)}
      </p>
    </div>
  );
}
