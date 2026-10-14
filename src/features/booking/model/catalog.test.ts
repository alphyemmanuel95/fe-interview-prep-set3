import { describe, expect, it } from 'vitest';
import { getEventName } from './catalog';

describe('getEventName', () => {
  it('names known events and falls back for a missing one', () => {
    expect(getEventName('jazz-night')).toBe('Jazz Night');
    expect(getEventName(null)).toBe('Unknown event');
  });
});
