export type TextSegment = Readonly<{
  /** Offset of the segment in the original text: unique and stable, so it doubles as a key. */
  start: number;
  text: string;
  isMatch: boolean;
}>;

/**
 * Splits `text` into matching and non-matching segments for every case-insensitive occurrence of
 * `query`. Uses indexOf rather than a RegExp, so user input never needs escaping, and returns
 * plain data so the UI renders `<mark>` elements instead of injecting HTML.
 */
export function splitByMatch(text: string, query: string): readonly TextSegment[] {
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  // Lower-casing can change length for a few characters (e.g. "İ"); offsets would then point at
  // the wrong characters, so fall back to no highlight rather than mark the wrong text.
  if (needle === '' || haystack.length !== text.length) {
    return [{ start: 0, text, isMatch: false }];
  }

  const segments: TextSegment[] = [];
  let cursor = 0;
  let matchIndex = haystack.indexOf(needle);
  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push({ start: cursor, text: text.slice(cursor, matchIndex), isMatch: false });
    }
    const matchEnd = matchIndex + needle.length;
    segments.push({ start: matchIndex, text: text.slice(matchIndex, matchEnd), isMatch: true });
    cursor = matchEnd;
    matchIndex = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) {
    segments.push({ start: cursor, text: text.slice(cursor), isMatch: false });
  }
  return segments;
}
