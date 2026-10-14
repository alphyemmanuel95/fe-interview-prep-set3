import { describe, expect, it } from 'vitest';
import { bookingReducer, createBookingState, EMPTY_DRAFT } from './bookingReducer';
import type { BookingAction, BookingState } from './bookingReducer';
import { MAX_SEATS_PER_BOOKING } from './catalog';
import type { SeatId } from './catalog';

const TODAY = '2026-10-14';

function reduce(state: BookingState, actions: readonly BookingAction[]): BookingState {
  return actions.reduce(bookingReducer, state);
}

function selectSeats(seatIds: readonly SeatId[]): BookingState {
  return reduce(
    createBookingState(EMPTY_DRAFT),
    seatIds.map((seatId) => ({ type: 'seatToggled', seatId })),
  );
}

describe('bookingReducer', () => {
  it('adds an empty attendee entry per seat, kept in seat layout order', () => {
    const state = selectSeats(['C3', 'A1']);

    expect(state.draft.seatIds).toEqual(['A1', 'C3']);
    expect(state.draft.attendees).toEqual({ A1: '', C3: '' });
  });

  it('removes only the deselected seat’s attendee entry', () => {
    const state = reduce(selectSeats(['A1', 'A2', 'C3']), [
      { type: 'attendeeNameChanged', seatId: 'A1', name: 'Asha' },
      { type: 'attendeeNameChanged', seatId: 'A2', name: 'Ben' },
      { type: 'attendeeNameChanged', seatId: 'C3', name: 'Chen' },
      { type: 'seatToggled', seatId: 'A2' },
    ]);

    expect(state.draft.seatIds).toEqual(['A1', 'C3']);
    expect(state.draft.attendees).toEqual({ A1: 'Asha', C3: 'Chen' });
  });

  it('never selects more than the maximum number of seats', () => {
    const state = selectSeats(['A1', 'A2', 'A3', 'A6', 'A7', 'A8', 'B1']);

    expect(state.draft.seatIds).toHaveLength(MAX_SEATS_PER_BOOKING);
    expect(state.draft.seatIds).not.toContain('B1');
  });

  it('ignores already-booked seats', () => {
    expect(selectSeats(['A4']).draft.seatIds).toEqual([]);
  });

  it('blocks Next on an invalid step and counts the failed attempt', () => {
    const state = bookingReducer(createBookingState(EMPTY_DRAFT), {
      type: 'nextRequested',
      today: TODAY,
    });

    expect(state.draft.step).toBe('event');
    expect(state.failedNextAttempts).toBe(1);
  });

  it('advances on a valid step and resets the failed attempts', () => {
    const state = reduce(createBookingState(EMPTY_DRAFT), [
      { type: 'nextRequested', today: TODAY },
      { type: 'eventSelected', eventId: 'jazz-night' },
      { type: 'dateChanged', date: TODAY },
      { type: 'nextRequested', today: TODAY },
    ]);

    expect(state.draft.step).toBe('seats');
    expect(state.failedNextAttempts).toBe(0);
  });

  it('keeps every entry when going back', () => {
    const atSeats = reduce(createBookingState(EMPTY_DRAFT), [
      { type: 'eventSelected', eventId: 'jazz-night' },
      { type: 'dateChanged', date: TODAY },
      { type: 'nextRequested', today: TODAY },
      { type: 'seatToggled', seatId: 'A1' },
    ]);
    const back = bookingReducer(atSeats, { type: 'backRequested' });

    expect(back.draft).toEqual({ ...atSeats.draft, step: 'event' });
  });

  it('only jumps back to earlier steps, never forward past validation', () => {
    const state = createBookingState(EMPTY_DRAFT);

    expect(bookingReducer(state, { type: 'stepRequested', step: 'review' })).toBe(state);
  });

  it('clears the draft once the booking succeeds', () => {
    const confirmation = {
      reference: 'ABC123',
      booking: { eventId: 'jazz-night', date: TODAY, attendees: [], totalCents: 0 },
    } as const;
    const state = bookingReducer(selectSeats(['A1']), { type: 'submitSucceeded', confirmation });

    expect(state.draft).toEqual(EMPTY_DRAFT);
    expect(state.submission).toEqual({ status: 'success', confirmation });
  });

  it('reveals the errors of the step a blocked submit returns to', () => {
    const state = bookingReducer(createBookingState({ ...EMPTY_DRAFT, step: 'review' }), {
      type: 'submitBlocked',
      step: 'event',
    });

    expect(state.draft.step).toBe('event');
    expect(state.failedNextAttempts).toBe(1);
  });

  it('ignores navigation while a submit is in flight', () => {
    const submitting = reduce(createBookingState({ ...EMPTY_DRAFT, step: 'review' }), [
      { type: 'submitStarted' },
    ]);

    expect(bookingReducer(submitting, { type: 'backRequested' })).toBe(submitting);
    expect(bookingReducer(submitting, { type: 'stepRequested', step: 'seats' })).toBe(submitting);
  });

  it('drops a failed submit’s error when the user goes back to edit', () => {
    const state = reduce(createBookingState({ ...EMPTY_DRAFT, step: 'review' }), [
      { type: 'submitStarted' },
      { type: 'submitFailed', error: 'Network down' },
      { type: 'stepRequested', step: 'seats' },
    ]);

    expect(state.draft.step).toBe('seats');
    expect(state.submission).toEqual({ status: 'idle' });
  });
});
