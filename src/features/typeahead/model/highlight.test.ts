import { describe, expect, it } from 'vitest';
import { splitByMatch } from './highlight';

describe('splitByMatch', () => {
  it('marks a case-insensitive match and keeps the original casing', () => {
    expect(splitByMatch('Adele Hart', 'DEL')).toEqual([
      { start: 0, text: 'A', isMatch: false },
      { start: 1, text: 'del', isMatch: true },
      { start: 4, text: 'e Hart', isMatch: false },
    ]);
  });

  it('marks every occurrence, including at the start and end', () => {
    expect(splitByMatch('anna', 'a')).toEqual([
      { start: 0, text: 'a', isMatch: true },
      { start: 1, text: 'nn', isMatch: false },
      { start: 3, text: 'a', isMatch: true },
    ]);
  });

  it('returns a single unmatched segment when there is no match', () => {
    expect(splitByMatch('Lima', 'del')).toEqual([{ start: 0, text: 'Lima', isMatch: false }]);
  });

  it('returns a single unmatched segment for an empty query', () => {
    expect(splitByMatch('Lima', '')).toEqual([{ start: 0, text: 'Lima', isMatch: false }]);
  });

  it('treats regular-expression characters literally', () => {
    expect(splitByMatch('a.b (c)', '(c)')).toEqual([
      { start: 0, text: 'a.b ', isMatch: false },
      { start: 4, text: '(c)', isMatch: true },
    ]);
  });

  it('does not highlight when lower-casing changes the text length', () => {
    expect(splitByMatch('İstanbul', 'stan')).toEqual([
      { start: 0, text: 'İstanbul', isMatch: false },
    ]);
  });
});
