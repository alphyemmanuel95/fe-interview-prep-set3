import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { assertNever } from '../../../shared/assertNever';
import { isToggleTarget, rowIdOf } from './treeDom';
import { getTreeKeyAction, type TreeKeyAction } from './treeNavigation';
import { TreeErrorRow, TreeItemRow } from './TreeRow';
import { useChildrenLoader, type LoadChildren } from './useChildrenLoader';
import { flattenVisibleRows, loadStatusMessage, pickTabStop } from './visibleRows';
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
  onSelect: (id: string) => void;
  /** Restricts rendering to these ids (e.g. search results plus their ancestors). */
  visibleIds?: ReadonlySet<string> | undefined;
  renderIcon?: (item: T, isExpanded: boolean) => ReactNode;
  renderLabel?: (item: T) => ReactNode;
}>;

export function Tree<T>(props: TreeProps<T>): JSX.Element {
  const { rootItems, getId, getLabel, isBranch, expandedIds, selectedId, visibleIds } = props;
  const { onExpandedChange, onSelect } = props;
  const { childrenById, load } = useChildrenLoader(props.loadChildren, getId);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rowElements = useRef(new Map<string, HTMLElement>());

  const rows = useMemo(
    () =>
      flattenVisibleRows({
        rootItems,
        accessors: { getId, getLabel, isBranch },
        expandedIds,
        childrenById,
        visibleIds,
      }),
    [rootItems, getId, getLabel, isBranch, expandedIds, childrenById, visibleIds],
  );
  const indexById = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows]);
  const rowById = (id: string) => rows[indexById.get(id) ?? -1];
  const tabStopId = pickTabStop(rows, indexById, [focusedId, selectedId]);
  const isSelectedRendered = selectedId !== null && indexById.has(selectedId);

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

  // Reveal the selected row once it renders, e.g. after a shared link's folders have loaded.
  useEffect(() => {
    if (selectedId !== null && isSelectedRendered) {
      rowElements.current.get(selectedId)?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedId, isSelectedRendered]);

  const registerRow = useCallback((id: string, element: HTMLElement | null) => {
    if (element === null) {
      rowElements.current.delete(id);
    } else {
      rowElements.current.set(id, element);
    }
  }, []);

  const activate = (id: string): void => {
    const row = rowById(id);
    if (row?.kind === 'error') {
      load(row.parent);
    } else if (row !== undefined) {
      onSelect(id);
    }
  };

  const runAction = (action: TreeKeyAction): void => {
    switch (action.type) {
      case 'focus':
        // DOM focus fires `handleFocus`, which moves the tab stop.
        rowElements.current.get(action.id)?.focus();
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

  const handleFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const id = rowIdOf(event.target);
    if (id !== undefined) {
      setFocusedId(id);
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
        {loadStatusMessage(rows)}
      </p>
    </div>
  );
}
