import { describe, expect, it } from 'vitest';
import type { SearchIndexEntry } from '../api/mockFileSystem';
import { searchTree, splitByMatch } from './search';

const INDEX: readonly SearchIndexEntry[] = [
  { id: 'src', label: 'src', ancestorIds: [] },
  { id: 'src/hooks', label: 'hooks', ancestorIds: ['src'] },
  { id: 'src/hooks/useTree.ts', label: 'useTree.ts', ancestorIds: ['src', 'src/hooks'] },
  { id: 'src/app.tsx', label: 'app.tsx', ancestorIds: ['src'] },
  { id: 'docs', label: 'docs', ancestorIds: [] },
  { id: 'docs/guide.md', label: 'guide.md', ancestorIds: ['docs'] },
];

describe('searchTree', () => {
  it('keeps every ancestor folder of a match visible and expanded', () => {
    const result = searchTree(INDEX, 'TREE');

    expect([...(result?.matchIds ?? [])]).toEqual(['src/hooks/useTree.ts']);
    expect([...(result?.visibleIds ?? [])]).toEqual(['src/hooks/useTree.ts', 'src', 'src/hooks']);
    expect([...(result?.expandedIds ?? [])]).toEqual(['src', 'src/hooks']);
  });

  it('hides branches without a match', () => {
    const result = searchTree(INDEX, 'tree');

    expect(result?.visibleIds.has('docs')).toBe(false);
    expect(result?.visibleIds.has('src/app.tsx')).toBe(false);
  });

  it('reports no matches, and no filter at all for a blank query', () => {
    expect(searchTree(INDEX, 'zzz')?.matchIds.size).toBe(0);
    expect(searchTree(INDEX, '   ')).toBeNull();
  });
});

describe('splitByMatch', () => {
  it('marks every case-insensitive occurrence', () => {
    expect(splitByMatch('Index.index', 'INDEX')).toEqual([
      { start: 0, text: 'Index', isMatch: true },
      { start: 5, text: '.', isMatch: false },
      { start: 6, text: 'index', isMatch: true },
    ]);
  });

  it('returns the text untouched without a query', () => {
    expect(splitByMatch('app.tsx', '')).toEqual([{ start: 0, text: 'app.tsx', isMatch: false }]);
  });
});
