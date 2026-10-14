import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

// The URL is the single source of truth for which folders are open and which node is selected:
// that is what makes a view shareable as a link and lets browser back/forward step through it.
// Nothing is mirrored into React state, so there is nothing to keep in sync.

const EXPANDED_PARAM = 'expanded';
const SELECTED_PARAM = 'selected';
/** Node ids are paths built from names without commas, so a comma list stays readable. */
const ID_SEPARATOR = ',';

export type TreeUrlState = Readonly<{
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  setExpanded: (id: string, isExpanded: boolean) => void;
  /**
   * Selects `id` and opens `ancestorIds` in the same history entry, so the link always shows the
   * selection — even when it was picked from search results whose folders were only search-opened.
   */
  select: (id: string, ancestorIds: readonly string[]) => void;
}>;

/** URLs are user input: blank or repeated ids are dropped; unknown ids simply match nothing. */
export function parseIdList(value: string | null): ReadonlySet<string> {
  if (value === null) {
    return new Set();
  }
  const ids = value
    .split(ID_SEPARATOR)
    .map((id) => id.trim())
    .filter((id) => id !== '');
  return new Set(ids);
}

export function useTreeUrlState(): TreeUrlState {
  const [searchParams, setSearchParams] = useSearchParams();
  const expandedParam = searchParams.get(EXPANDED_PARAM);
  const selectedParam = searchParams.get(SELECTED_PARAM);
  // Keyed on the raw string so a selection change keeps the same Set (and the tree's row memo).
  const expandedIds = useMemo(() => parseIdList(expandedParam), [expandedParam]);
  const selectedId = selectedParam === null || selectedParam === '' ? null : selectedParam;

  // Expand/collapse and select push history entries, so back/forward walk through them.
  const setExpanded = (id: string, isExpanded: boolean): void => {
    if (expandedIds.has(id) === isExpanded) {
      return;
    }
    const next = new Set(expandedIds);
    if (isExpanded) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSearchParams((params) => {
      if (next.size === 0) {
        params.delete(EXPANDED_PARAM);
      } else {
        params.set(EXPANDED_PARAM, [...next].join(ID_SEPARATOR));
      }
      return params;
    });
  };

  const select = (id: string, ancestorIds: readonly string[]): void => {
    const hiddenAncestorIds = ancestorIds.filter((ancestorId) => !expandedIds.has(ancestorId));
    if (id === selectedId && hiddenAncestorIds.length === 0) {
      return;
    }
    setSearchParams((params) => {
      params.set(SELECTED_PARAM, id);
      if (hiddenAncestorIds.length > 0) {
        params.set(EXPANDED_PARAM, [...expandedIds, ...hiddenAncestorIds].join(ID_SEPARATOR));
      }
      return params;
    });
  };

  return { expandedIds, selectedId, setExpanded, select };
}
