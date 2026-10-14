import type { ChildrenSnapshot, ChildrenState } from './childrenCache';
import type { ItemRow, VisibleRow } from './visibleRows';

type SettledState<T> = Exclude<ChildrenState<T>, { status: 'loading' }>;

const itemCount = (count: number): string => (count === 1 ? '1 item' : `${count} items`);

/**
 * Text for the tree's polite live region, derived from rows and cache instead of stored: which
 * folders are loading, otherwise the outcome of the most recently settled load. Each new outcome
 * changes the text, so screen readers announce every load, not just the first.
 */
export function loadAnnouncement<T>(
  rows: readonly VisibleRow<T>[],
  childrenById: ChildrenSnapshot<T>,
  getLabel: (item: T) => string,
): string {
  const itemRows = rows.filter((row): row is ItemRow<T> => row.kind === 'item');
  const loadingLabels = itemRows
    .filter((row) => row.isExpanded && row.loadStatus === 'loading')
    .map((row) => getLabel(row.item));
  if (loadingLabels.length > 0) {
    return `Loading ${loadingLabels.join(', ')}…`;
  }

  let latest: Readonly<{ row: ItemRow<T>; state: SettledState<T> }> | null = null;
  for (const row of itemRows) {
    const state = childrenById.get(row.id);
    if (
      state !== undefined &&
      state.status !== 'loading' &&
      (latest === null || state.settledOrder > latest.state.settledOrder)
    ) {
      latest = { row, state };
    }
  }
  if (latest === null) {
    return '';
  }
  const label = getLabel(latest.row.item);
  return latest.state.status === 'error'
    ? `Could not load ${label}`
    : `${label}: ${itemCount(latest.state.children.length)}`;
}
