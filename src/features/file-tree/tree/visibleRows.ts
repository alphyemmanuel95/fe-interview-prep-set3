import { assertNever } from '../../../shared/assertNever';
import type { ChildrenSnapshot } from './childrenCache';

/** How the tree reads any item. Must be referentially stable (module scope or `useCallback`). */
export type TreeAccessors<T> = Readonly<{
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  isBranch: (item: T) => boolean;
}>;

export type LoadStatus = 'idle' | 'loading' | 'error' | 'success';

export type ItemRow<T> = Readonly<{
  kind: 'item';
  id: string;
  item: T;
  level: number;
  parentId: string | null;
  posInSet: number;
  setSize: number;
  isBranch: boolean;
  isExpanded: boolean;
  loadStatus: LoadStatus;
}>;

/** Stands in for the children of a branch whose load failed; activating it retries. */
export type ErrorRow<T> = Readonly<{
  kind: 'error';
  id: string;
  parent: T;
  parentId: string;
  level: number;
  message: string;
}>;

export type VisibleRow<T> = ItemRow<T> | ErrorRow<T>;

export type FlattenInput<T> = Readonly<{
  rootItems: readonly T[];
  accessors: TreeAccessors<T>;
  expandedIds: ReadonlySet<string>;
  childrenById: ChildrenSnapshot<T>;
  /** When set, only these ids render (a search filter); everything else is skipped. */
  visibleIds?: ReadonlySet<string> | undefined;
}>;

const ERROR_ROW_SUFFIX = '::load-error';

// The tree renders as one flat list of the rows a user can currently see. That makes keyboard
// navigation index-based (next/previous/first/last) and keeps rendering a single `map`.
export function flattenVisibleRows<T>(input: FlattenInput<T>): readonly VisibleRow<T>[] {
  const { accessors, expandedIds, childrenById, visibleIds } = input;
  const rows: VisibleRow<T>[] = [];

  const visit = (items: readonly T[], level: number, parentId: string | null): void => {
    const shown =
      visibleIds === undefined
        ? items
        : items.filter((item) => visibleIds.has(accessors.getId(item)));
    shown.forEach((item, index) => {
      const id = accessors.getId(item);
      const isBranch = accessors.isBranch(item);
      const isExpanded = isBranch && expandedIds.has(id);
      const state = childrenById.get(id);
      rows.push({
        kind: 'item',
        id,
        item,
        level,
        parentId,
        posInSet: index + 1,
        setSize: shown.length,
        isBranch,
        isExpanded,
        loadStatus: state?.status ?? 'idle',
      });
      if (!isExpanded || state === undefined) {
        return;
      }
      switch (state.status) {
        case 'loading':
          return;
        case 'error':
          rows.push({
            kind: 'error',
            id: `${id}${ERROR_ROW_SUFFIX}`,
            parent: item,
            parentId: id,
            level: level + 1,
            message: state.error,
          });
          return;
        case 'success':
          visit(state.children, level + 1, id);
          return;
        default:
          assertNever(state);
      }
    });
  };

  visit(input.rootItems, 1, null);
  return rows;
}

/** Roving tabindex target: the first candidate that is visible, else the first row. */
export function pickTabStop<T>(
  rows: readonly VisibleRow<T>[],
  indexById: ReadonlyMap<string, number>,
  candidates: readonly (string | null)[],
): string | null {
  const visible = candidates.find((id) => id !== null && indexById.has(id));
  return visible ?? rows[0]?.id ?? null;
}

/** Text for the tree's polite live region, derived from the rows instead of stored. */
export function loadStatusMessage<T>(rows: readonly VisibleRow<T>[]): string {
  if (rows.some((row) => row.kind === 'item' && row.isExpanded && row.loadStatus === 'loading')) {
    return 'Loading…';
  }
  return rows.some((row) => row.kind === 'error') ? 'Some items could not be loaded.' : '';
}
