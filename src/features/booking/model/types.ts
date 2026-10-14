import type { EventId, SeatId } from './catalog';
import type { BookingStep } from './steps';

/** Attendee names keyed by seat, so removing a seat removes exactly that seat's entry. */
export type Attendees = Readonly<Partial<Record<SeatId, string>>>;

/** The minimal source of truth that is persisted. Prices and counts are derived from it. */
export type BookingDraft = Readonly<{
  step: BookingStep;
  eventId: EventId | null;
  /** Local `YYYY-MM-DD`, or `''` when not chosen yet. */
  date: string;
  seatIds: readonly SeatId[];
  attendees: Attendees;
}>;

export type BookingField = 'event' | 'date' | 'seats' | `attendee-${SeatId}`;

export type FieldError = Readonly<{ field: BookingField; message: string }>;

export type AttendeeBooking = Readonly<{ seatId: SeatId; name: string }>;

export type BookingRequest = Readonly<{
  eventId: EventId;
  date: string;
  attendees: readonly AttendeeBooking[];
  /** In minor units: paise for INR. */
  totalCents: number;
}>;

export type BookingConfirmation = Readonly<{ reference: string; booking: BookingRequest }>;
