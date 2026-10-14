import { assertNever } from '../../../shared/assertNever';
import { MAX_SEATS_PER_BOOKING } from './catalog';
import type { SeatId } from './catalog';
import { parseIsoDate } from './localDate';
import { BOOKING_STEPS } from './steps';
import type { BookingStep } from './steps';
import type { Attendees, BookingDraft, BookingField, FieldError } from './types';

// Validators are pure and take `today` as an argument, so they are deterministic in tests
// and the reducer can enforce "no advancing past an invalid step" without reading the clock.

export function validateEventStep(
  draft: Pick<BookingDraft, 'eventId' | 'date'>,
  today: string,
): readonly FieldError[] {
  const errors: FieldError[] = [];
  if (draft.eventId === null) {
    errors.push({ field: 'event', message: 'Choose an event.' });
  }
  if (draft.date === '') {
    errors.push({ field: 'date', message: 'Choose a date.' });
  } else if (parseIsoDate(draft.date) === null) {
    errors.push({ field: 'date', message: 'Enter a valid date.' });
  } else if (draft.date < today) {
    errors.push({ field: 'date', message: 'Choose today or a future date.' });
  }
  return errors;
}

export function validateSeatStep(seatIds: readonly SeatId[]): readonly FieldError[] {
  if (seatIds.length === 0) {
    return [{ field: 'seats', message: 'Choose at least 1 seat.' }];
  }
  if (seatIds.length > MAX_SEATS_PER_BOOKING) {
    return [{ field: 'seats', message: `Choose no more than ${MAX_SEATS_PER_BOOKING} seats.` }];
  }
  return [];
}

export function validateAttendeeStep(
  seatIds: readonly SeatId[],
  attendees: Attendees,
): readonly FieldError[] {
  return seatIds
    .filter((seatId) => (attendees[seatId] ?? '').trim() === '')
    .map((seatId) => ({
      field: getAttendeeField(seatId),
      message: `Enter the attendee name for seat ${seatId}.`,
    }));
}

export function validateStep(
  step: BookingStep,
  draft: BookingDraft,
  today: string,
): readonly FieldError[] {
  switch (step) {
    case 'event':
      return validateEventStep(draft, today);
    case 'seats':
      return validateSeatStep(draft.seatIds);
    case 'attendees':
      return validateAttendeeStep(draft.seatIds, draft.attendees);
    case 'review':
      return [];
    default:
      return assertNever(step);
  }
}

/** The earliest step that still has errors, or `null` when the whole draft is valid. */
export function findFirstInvalidStep(draft: BookingDraft, today: string): BookingStep | null {
  return BOOKING_STEPS.find((step) => validateStep(step, draft, today).length > 0) ?? null;
}

export function getAttendeeField(seatId: SeatId): BookingField {
  return `attendee-${seatId}`;
}

export function findFieldError(
  errors: readonly FieldError[],
  field: BookingField,
): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}
