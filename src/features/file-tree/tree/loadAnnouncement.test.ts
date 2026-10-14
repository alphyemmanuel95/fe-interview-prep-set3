import { describe, expect, it } from 'vitest';
import type { ChildrenState } from './childrenCache';
import { loadAnnouncement } from './loadAnnouncement';
import type { ItemRow } from './visibleRows';

const folder = (id: string, overrides: Partial<ItemRow<string>> = {}): ItemRow<string> => ({
  kind: 'item',
  id,
  item: id,
  level: 1,
  parentId: null,
  posInSet: 1,
  setSize: 1,
  isBranch: true,
  isExpanded: true,
  loadStatus: 'idle',
  ...overrides,
});

const label = (item: string) => item.toUpperCase();

describe('loadAnnouncement', () => {
  it('names every folder that is loading', () => {
    const rows = [
      folder('docs', { loadStatus: 'loading' }),
      folder('src', { loadStatus: 'loading' }),
    ];

    expect(loadAnnouncement(rows, new Map(), label)).toBe('Loading DOCS, SRC…');
  });

  it('reports the most recently settled load, success or failure', () => {
    const rows = [folder('docs'), folder('src')];
    const children = new Map<string, ChildrenState<string>>([
      ['docs', { status: 'success', children: ['a', 'b'], settledOrder: 1 }],
      ['src', { status: 'error', error: 'Offline', settledOrder: 2 }],
    ]);

    expect(loadAnnouncement(rows, children, label)).toBe('Could not load SRC');
    expect(loadAnnouncement(rows.slice(0, 1), children, label)).toBe('DOCS: 2 items');
  });

  it('stays silent before anything has loaded', () => {
    expect(loadAnnouncement([folder('docs', { isExpanded: false })], new Map(), label)).toBe('');
  });
});
