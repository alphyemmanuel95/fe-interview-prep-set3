import { pickAttendees } from './bookingReducer';
import { isEventId, isSeatBooked, MAX_SEATS_PER_BOOKING, sortSeatIds } from './catalog';
import { isBookingStep, isStepBefore } from './steps';
import type { BookingDraft } from './types';
import { findFirstInvalidStep } from './validation';

/** What a draft looks like on disk: structurally checked, but not yet trusted as domain values. */
export type StoredDraft = Readonly<{
  step: string;
  eventId: string | null;
  date: string;
  seatIds: readonly string[];
  attendees: Readonly<Record<string, string>>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isStringRecord = (value: unknown): value is Readonly<Record<string, string>> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

export function isStoredDraft(value: unknown): value is StoredDraft {
  return (
    isRecord(value) &&
    typeof value['step'] === 'string' &&
    (value['eventId'] === null || typeof value['eventId'] === 'string') &&
    typeof value['date'] === 'string' &&
    isStringArray(value['seatIds']) &&
    isStringRecord(value['attendees'])
  );
}

export type RestoredDraft = Readonly<{
  draft: BookingDraft;
  /** True when progress had to be rewound to a step that is no longer valid. */
  wasRewound: boolean;
}>;

/**
 * Turns a stored draft back into domain values, dropping anything that is no longer valid:
 * unknown events, seats that are unknown or booked since, and attendees without a seat.
 * It never resumes past a step that is now invalid, e.g. a saved date that is in the past.
 */
export function restoreDraft(stored: StoredDraft, today: string): RestoredDraft {
  const seatIds = sortSeatIds(stored.seatIds)
    .filter((seatId) => !isSeatBooked(seatId))
    .slice(0, MAX_SEATS_PER_BOOKING);
  const draft: BookingDraft = {
    step: isBookingStep(stored.step) ? stored.step : 'event',
    eventId: stored.eventId !== null && isEventId(stored.eventId) ? stored.eventId : null,
    date: stored.date,
    seatIds,
    attendees: pickAttendees(seatIds, stored.attendees),
  };
  const firstInvalidStep = findFirstInvalidStep(draft, today);
  if (firstInvalidStep !== null && isStepBefore(firstInvalidStep, draft.step)) {
    return { draft: { ...draft, step: firstInvalidStep }, wasRewound: true };
  }
  return { draft, wasRewound: false };
}
