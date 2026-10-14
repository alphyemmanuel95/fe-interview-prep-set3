import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingRequest } from '../model/types';
import { SIMULATED_LATENCY_MS, submitBooking } from './submitBooking';

const request: BookingRequest = {
  eventId: 'jazz-night',
  date: '2026-10-20',
  attendees: [{ seatId: 'A1', name: 'Asha' }],
  totalCents: 50_000,
};

describe('submitBooking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('confirms the booking after the simulated latency', async () => {
    const result = submitBooking(request, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(SIMULATED_LATENCY_MS);

    const confirmation = await result;
    expect(confirmation.booking).toBe(request);
    expect(confirmation.reference).toMatch(/^[0-9A-F]{8}$/);
  });

  it('rejects with an AbortError and cancels its timer when aborted', async () => {
    const controller = new AbortController();
    const result = submitBooking(request, controller.signal);

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
