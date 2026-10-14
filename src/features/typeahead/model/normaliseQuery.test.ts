import { describe, expect, it } from 'vitest';
import { normaliseQuery } from './normaliseQuery';

describe('normaliseQuery', () => {
  it('trims and lower-cases the query', () => {
    expect(normaliseQuery('  DeL ')).toBe('del');
  });

  it('collapses inner whitespace', () => {
    expect(normaliseQuery('new   \t york')).toBe('new york');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normaliseQuery('   ')).toBe('');
  });
});
