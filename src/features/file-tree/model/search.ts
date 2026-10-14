import type { SearchIndexEntry } from '../api/mockFileSystem';

export type TreeSearchResult = Readonly<{
  matchCount: number;
  /** Matches plus every ancestor folder of a match: what the filtered tree shows. */
  visibleIds: ReadonlySet<string>;
  /** Ancestors of matches: opened while searching so each match is actually reachable. */
  expandedIds: ReadonlySet<string>;
}>;

export type TextSegment = Readonly<{ start: number; text: string; isMatch: boolean }>;

const normalise = (text: string): string => text.trim().toLocaleLowerCase();

// Searches the flat index instead of the loaded tree, so matches inside folders the user never
// opened are still found; the tree then loads just the ancestor folders needed to show them.
export function searchTree(
  index: readonly SearchIndexEntry[],
  query: string,
): TreeSearchResult | null {
  const needle = normalise(query);
  if (needle === '') {
    return null;
  }
  let matchCount = 0;
  const visibleIds = new Set<string>();
  const expandedIds = new Set<string>();
  for (const entry of index) {
    if (!entry.label.toLocaleLowerCase().includes(needle)) {
      continue;
    }
    matchCount += 1;
    visibleIds.add(entry.id);
    for (const ancestorId of entry.ancestorIds) {
      visibleIds.add(ancestorId);
      expandedIds.add(ancestorId);
    }
  }
  return { matchCount, visibleIds, expandedIds };
}

/** Splits `text` around every case-insensitive occurrence of `query` for highlighting. */
export function splitByMatch(text: string, query: string): readonly TextSegment[] {
  const needle = normalise(query);
  if (needle === '') {
    return [{ start: 0, text, isMatch: false }];
  }
  const haystack = text.toLocaleLowerCase();
  const segments: TextSegment[] = [];
  let cursor = 0;
  let matchStart = haystack.indexOf(needle);
  while (matchStart !== -1) {
    if (matchStart > cursor) {
      segments.push({ start: cursor, text: text.slice(cursor, matchStart), isMatch: false });
    }
    const matchEnd = matchStart + needle.length;
    segments.push({ start: matchStart, text: text.slice(matchStart, matchEnd), isMatch: true });
    cursor = matchEnd;
    matchStart = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) {
    segments.push({ start: cursor, text: text.slice(cursor), isMatch: false });
  }
  return segments;
}
