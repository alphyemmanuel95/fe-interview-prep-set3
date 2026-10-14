import { describe, expect, it, vi } from 'vitest';
import { loadFromStorage, saveToStorage } from './storage';

const KEY = 'test-key';
const VERSION = 1;
const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number');

describe('storage', () => {
  it('round-trips data that passes the guard', () => {
    saveToStorage(KEY, VERSION, [1, 2, 3]);
    expect(loadFromStorage(KEY, VERSION, isNumberArray, [])).toEqual([1, 2, 3]);
  });

  it('returns the fallback when nothing is stored', () => {
    expect(loadFromStorage(KEY, VERSION, isNumberArray, [9])).toEqual([9]);
  });

  it('returns the fallback for invalid JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadFromStorage(KEY, VERSION, isNumberArray, [])).toEqual([]);
  });

  it('returns the fallback when the shape fails the guard', () => {
    saveToStorage(KEY, VERSION, ['a', 'b']);
    expect(loadFromStorage(KEY, VERSION, isNumberArray, [])).toEqual([]);
  });

  it('returns the fallback when the stored version is different', () => {
    saveToStorage(KEY, VERSION, [1]);
    expect(loadFromStorage(KEY, VERSION + 1, isNumberArray, [])).toEqual([]);
  });

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => {
      saveToStorage(KEY, VERSION, [1]);
    }).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
