import { describe, expect, it } from 'vitest';
import type { ChildrenState } from './childrenCache';
import { flattenVisibleRows, type TreeAccessors, type TreeFilter } from './visibleRows';

type Node = Readonly<{ id: string; isBranch: boolean }>;

const accessors: TreeAccessors<Node> = {
  getId: (node) => node.id,
  getLabel: (node) => node.id,
  isBranch: (node) => node.isBranch,
};

const docs: Node = { id: 'docs', isBranch: true };
const src: Node = { id: 'src', isBranch: true };
const readme: Node = { id: 'readme', isBranch: false };
const guide: Node = { id: 'docs/guide', isBranch: false };
const faq: Node = { id: 'docs/faq', isBranch: false };

const loaded = new Map<string, ChildrenState<Node>>([
  ['docs', { status: 'success', children: [guide, faq] }],
  ['src', { status: 'error', error: 'Offline' }],
]);

const flatten = (expanded: readonly string[], filter?: TreeFilter) =>
  flattenVisibleRows({
    rootItems: [docs, src, readme],
    accessors,
    expandedIds: new Set(expanded),
    childrenById: loaded,
    filter,
  });

describe('flattenVisibleRows', () => {
  it('lists only root rows while nothing is expanded', () => {
    expect(flatten([]).map((row) => row.id)).toEqual(['docs', 'src', 'readme']);
  });

  it('places loaded children right after their expanded parent, one level deeper', () => {
    const rows = flatten(['docs']);

    expect(rows.map((row) => row.id)).toEqual(['docs', 'docs/guide', 'docs/faq', 'src', 'readme']);
    expect(rows[1]).toMatchObject({ level: 2, parentId: 'docs', posInSet: 1, setSize: 2 });
  });

  it('adds an error row under an expanded branch whose load failed', () => {
    const rows = flatten(['src']);

    expect(rows[2]).toMatchObject({ kind: 'error', parentId: 'src', level: 2, message: 'Offline' });
  });

  it('skips rows outside the visible set and renumbers positions among what remains', () => {
    const rows = flatten(['docs'], {
      visibleIds: new Set(['docs', 'docs/faq']),
      matchIds: new Set(['docs/faq']),
    });

    expect(rows.map((row) => row.id)).toEqual(['docs', 'docs/faq']);
    expect(rows[0]).toMatchObject({ posInSet: 1, setSize: 1 });
    expect(rows[1]).toMatchObject({ posInSet: 1, setSize: 1 });
  });

  it('shows the whole contents of a matching folder', () => {
    const rows = flatten(['docs'], { visibleIds: new Set(['docs']), matchIds: new Set(['docs']) });

    expect(rows.map((row) => row.id)).toEqual(['docs', 'docs/guide', 'docs/faq']);
  });
});
