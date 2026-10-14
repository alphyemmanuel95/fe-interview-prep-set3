import { getPriceBreakdown } from './pricing';
import type { BookingStep } from './steps';
import type { BookingDraft, BookingRequest } from './types';
import { findFirstInvalidStep } from './validation';

export type PreparedBooking =
  | Readonly<{ status: 'ready'; request: BookingRequest }>
  | Readonly<{ status: 'invalid'; step: BookingStep }>;

/**
 * Re-validates the whole draft right before submitting: the review step can be reached with
 * data that has since gone stale (e.g. the chosen date became "yesterday" overnight).
 */
export function prepareBookingRequest(draft: BookingDraft, today: string): PreparedBooking {
  const invalidStep = findFirstInvalidStep(draft, today);
  if (invalidStep !== null) {
    return { status: 'invalid', step: invalidStep };
  }
  // Already covered by the event step's validator; repeated so the type narrows to EventId.
  if (draft.eventId === null) {
    return { status: 'invalid', step: 'event' };
  }
  return {
    status: 'ready',
    request: {
      eventId: draft.eventId,
      date: draft.date,
      attendees: draft.seatIds.map((seatId) => ({
        seatId,
        name: (draft.attendees[seatId] ?? '').trim(),
      })),
      totalCents: getPriceBreakdown(draft.seatIds).totalCents,
    },
  };
}
