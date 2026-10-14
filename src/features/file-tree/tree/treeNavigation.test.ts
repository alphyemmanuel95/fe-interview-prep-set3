import { describe, expect, it } from 'vitest';
import { getTreeKeyAction } from './treeNavigation';
import type { ItemRow, VisibleRow } from './visibleRows';

const itemRow = (overrides: Partial<ItemRow<string>> & Pick<ItemRow<string>, 'id'>) =>
  ({
    kind: 'item',
    item: overrides.id,
    level: 1,
    parentId: null,
    posInSet: 1,
    setSize: 1,
    isBranch: false,
    isExpanded: false,
    loadStatus: 'idle',
    ...overrides,
  }) satisfies ItemRow<string>;

// docs (open) > guide, faq; src (closed); readme
const rows: readonly VisibleRow<string>[] = [
  itemRow({ id: 'docs', isBranch: true, isExpanded: true, loadStatus: 'success' }),
  itemRow({ id: 'docs/guide', level: 2, parentId: 'docs' }),
  itemRow({ id: 'docs/faq', level: 2, parentId: 'docs' }),
  itemRow({ id: 'src', isBranch: true }),
  itemRow({ id: 'readme' }),
];

describe('getTreeKeyAction', () => {
  it('moves focus down and up, stopping at the ends', () => {
    expect(getTreeKeyAction(rows, 0, 'ArrowDown')).toEqual({ type: 'focus', id: 'docs/guide' });
    expect(getTreeKeyAction(rows, 4, 'ArrowDown')).toEqual({ type: 'focus', id: 'readme' });
    expect(getTreeKeyAction(rows, 0, 'ArrowUp')).toEqual({ type: 'focus', id: 'docs' });
  });

  it('jumps to the first and last visible rows with Home and End', () => {
    expect(getTreeKeyAction(rows, 2, 'Home')).toEqual({ type: 'focus', id: 'docs' });
    expect(getTreeKeyAction(rows, 2, 'End')).toEqual({ type: 'focus', id: 'readme' });
  });

  it('expands a closed branch, then moves into its first child', () => {
    expect(getTreeKeyAction(rows, 3, 'ArrowRight')).toEqual({ type: 'expand', id: 'src' });
    expect(getTreeKeyAction(rows, 0, 'ArrowRight')).toEqual({ type: 'focus', id: 'docs/guide' });
    expect(getTreeKeyAction(rows, 4, 'ArrowRight')).toEqual({ type: 'none' });
  });

  it('collapses an open branch, otherwise moves to the parent', () => {
    expect(getTreeKeyAction(rows, 0, 'ArrowLeft')).toEqual({ type: 'collapse', id: 'docs' });
    expect(getTreeKeyAction(rows, 2, 'ArrowLeft')).toEqual({ type: 'focus', id: 'docs' });
    expect(getTreeKeyAction(rows, 4, 'ArrowLeft')).toEqual({ type: 'none' });
  });

  it('activates the row on Enter and Space and ignores other keys', () => {
    expect(getTreeKeyAction(rows, 1, 'Enter')).toEqual({ type: 'activate', id: 'docs/guide' });
    expect(getTreeKeyAction(rows, 1, ' ')).toEqual({ type: 'activate', id: 'docs/guide' });
    expect(getTreeKeyAction(rows, 1, 'a')).toBeNull();
  });
});
