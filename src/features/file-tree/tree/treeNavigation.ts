import type { VisibleRow } from './visibleRows';

// Keyboard behaviour of the WAI-ARIA tree pattern as a pure function of the visible rows, so every
// key is unit-testable without rendering. The component only executes the returned action.
export type TreeKeyAction =
  | Readonly<{ type: 'focus'; id: string }>
  | Readonly<{ type: 'expand'; id: string }>
  | Readonly<{ type: 'collapse'; id: string }>
  | Readonly<{ type: 'activate'; id: string }>
  /** A tree key with nothing to do here (e.g. ArrowUp on the first row): still swallow it. */
  | Readonly<{ type: 'none' }>;

const NONE: TreeKeyAction = { type: 'none' };

function focusAt<T>(rows: readonly VisibleRow<T>[], index: number): TreeKeyAction {
  const row = rows[Math.min(Math.max(index, 0), rows.length - 1)];
  return row === undefined ? NONE : { type: 'focus', id: row.id };
}

function arrowRight<T>(rows: readonly VisibleRow<T>[], index: number): TreeKeyAction {
  const row = rows[index];
  if (row?.kind !== 'item' || !row.isBranch) {
    return NONE;
  }
  if (!row.isExpanded) {
    return { type: 'expand', id: row.id };
  }
  // Children may still be loading, in which case the next row is not a child yet.
  const next = rows[index + 1];
  return next?.parentId === row.id ? { type: 'focus', id: next.id } : NONE;
}

function arrowLeft<T>(rows: readonly VisibleRow<T>[], index: number): TreeKeyAction {
  const row = rows[index];
  if (row === undefined) {
    return NONE;
  }
  if (row.kind === 'item' && row.isExpanded) {
    return { type: 'collapse', id: row.id };
  }
  return row.parentId === null ? NONE : { type: 'focus', id: row.parentId };
}

/** Returns `null` for keys the tree does not handle, so they keep their default behaviour. */
export function getTreeKeyAction<T>(
  rows: readonly VisibleRow<T>[],
  activeIndex: number,
  key: string,
): TreeKeyAction | null {
  switch (key) {
    case 'ArrowDown':
      return focusAt(rows, activeIndex + 1);
    case 'ArrowUp':
      return focusAt(rows, activeIndex - 1);
    case 'Home':
      return focusAt(rows, 0);
    case 'End':
      return focusAt(rows, rows.length - 1);
    case 'ArrowRight':
      return arrowRight(rows, activeIndex);
    case 'ArrowLeft':
      return arrowLeft(rows, activeIndex);
    case 'Enter':
    case ' ': {
      const row = rows[activeIndex];
      return row === undefined ? NONE : { type: 'activate', id: row.id };
    }
    default:
      return null;
  }
}
