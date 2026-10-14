import { describe, expect, it } from 'vitest';
import { parseIdList } from './useTreeUrlState';

describe('parseIdList', () => {
  it('reads a comma-separated list of ids in order', () => {
    expect([...parseIdList('src,src/components')]).toEqual(['src', 'src/components']);
  });

  it('drops blanks and duplicates from hand-edited links', () => {
    expect([...parseIdList(' src,,src , ')]).toEqual(['src']);
  });

  it('treats a missing parameter as nothing expanded', () => {
    expect(parseIdList(null).size).toBe(0);
  });
});
