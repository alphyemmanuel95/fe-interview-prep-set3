import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalToday } from './useLocalToday';

const HOUR_MS = 60 * 60 * 1_000;

describe('useLocalToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 23));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rolls over at local midnight', async () => {
    const { result } = renderHook(() => useLocalToday());
    expect(result.current).toBe('2026-10-14');

    await act(() => vi.advanceTimersByTimeAsync(HOUR_MS));

    expect(result.current).toBe('2026-10-15');
  });

  it('keeps rolling over when the timer fires before the day has changed', async () => {
    const { result } = renderHook(() => useLocalToday());
    // The wall clock jumps back (sleep, NTP or DST), so the timer fires while it is still the 14th.
    vi.setSystemTime(new Date(2026, 9, 14, 22));

    await act(() => vi.advanceTimersByTimeAsync(HOUR_MS));
    expect(result.current).toBe('2026-10-14');
    await act(() => vi.advanceTimersByTimeAsync(HOUR_MS));

    expect(result.current).toBe('2026-10-15');
  });
});
