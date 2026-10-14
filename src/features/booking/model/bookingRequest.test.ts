import { describe, expect, it } from 'vitest';
import { prepareBookingRequest } from './bookingRequest';
import type { BookingDraft } from './types';

const TODAY = '2026-10-14';

const reviewDraft: BookingDraft = {
  step: 'review',
  eventId: 'jazz-night',
  date: '2026-10-20',
  seatIds: ['A1', 'C3'],
  attendees: { A1: '  Asha  ', C3: 'Chen' },
};

describe('prepareBookingRequest', () => {
  it('builds the request with trimmed names and the derived total', () => {
    expect(prepareBookingRequest(reviewDraft, TODAY)).toEqual({
      status: 'ready',
      request: {
        eventId: 'jazz-night',
        date: '2026-10-20',
        attendees: [
          { seatId: 'A1', name: 'Asha' },
          { seatId: 'C3', name: 'Chen' },
        ],
        totalCents: 75_000,
      },
    });
  });

  it('points at the first invalid step when the draft has gone stale', () => {
    expect(prepareBookingRequest(reviewDraft, '2026-10-21')).toEqual({
      status: 'invalid',
      step: 'event',
    });
  });
});
