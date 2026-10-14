import { useMemo, useState } from 'react';
import type { SearchIndexEntry } from '../api/mockFileSystem';
import { searchTree, type TreeSearchResult } from '../model/search';
import { useDebouncedValue } from './useDebouncedValue';

// Each search can open many folders, and each opened folder is a request: wait for a pause.
export const SEARCH_DEBOUNCE_MS = 250;

export type TreeSearch = Readonly<{
  query: string;
  setQuery: (query: string) => void;
  /** The debounced query `result` was computed for. */
  activeQuery: string;
  result: TreeSearchResult | null;
  /** What the tree should show as expanded: the URL's folders, plus the search's while searching. */
  expandedIds: ReadonlySet<string>;
  setExpanded: (id: string, isExpanded: boolean) => void;
}>;

type LocalCollapse = Readonly<{ query: string; ids: ReadonlySet<string> }>;

const NO_IDS: ReadonlySet<string> = new Set();

// Search text is transient view state, kept out of the URL: only expanded + selected are shared.
export function useTreeSearch(
  index: readonly SearchIndexEntry[],
  urlExpandedIds: ReadonlySet<string>,
  setUrlExpanded: (id: string, isExpanded: boolean) => void,
): TreeSearch {
  const [query, setQuery] = useState('');
  const activeQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const result = useMemo(() => searchTree(index, activeQuery), [index, activeQuery]);

  // Folders the search opened can still be collapsed. That choice is local to the current query:
  // it never reaches the URL, and it is ignored (rather than reset by an effect) once the query
  // changes, because it is stored together with the query it belongs to.
  const [localCollapse, setLocalCollapse] = useState<LocalCollapse>({ query: '', ids: NO_IDS });
  const collapsedIds = localCollapse.query === activeQuery ? localCollapse.ids : NO_IDS;

  const expandedIds = useMemo(() => {
    if (result === null) {
      return urlExpandedIds;
    }
    const ids = new Set([...urlExpandedIds, ...result.expandedIds]);
    for (const id of collapsedIds) {
      ids.delete(id);
    }
    return ids;
  }, [urlExpandedIds, result, collapsedIds]);

  const setExpanded = (id: string, isExpanded: boolean): void => {
    if (result?.expandedIds.has(id) !== true) {
      setUrlExpanded(id, isExpanded);
      return;
    }
    const ids = new Set(collapsedIds);
    if (isExpanded) {
      ids.delete(id);
    } else {
      ids.add(id);
    }
    setLocalCollapse({ query: activeQuery, ids });
  };

  return { query, setQuery, activeQuery, result, expandedIds, setExpanded };
}
