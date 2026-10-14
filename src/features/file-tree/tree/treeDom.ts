// Click and focus handling is delegated to the tree element; these map an event target back to
// the row it happened in, using the data attributes each row renders.

const ROW_ID_SELECTOR = '[data-tree-row-id]';
const TOGGLE_SELECTOR = '[data-tree-toggle]';

export function rowIdOf(target: EventTarget): string | undefined {
  const row = target instanceof Element ? target.closest(ROW_ID_SELECTOR) : null;
  return row instanceof HTMLElement ? row.dataset['treeRowId'] : undefined;
}

export function isToggleTarget(target: EventTarget): boolean {
  return target instanceof Element && target.closest(TOGGLE_SELECTOR) !== null;
}
