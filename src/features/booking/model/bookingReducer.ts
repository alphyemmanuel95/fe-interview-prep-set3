import { assertNever } from '../../../shared/assertNever';
import { isSeatBooked, MAX_SEATS_PER_BOOKING, sortSeatIds } from './catalog';
import type { EventId, SeatId } from './catalog';
import { getNextStep, getPreviousStep, isStepBefore } from './steps';
import type { BookingStep } from './steps';
import type { Attendees, BookingConfirmation, BookingDraft } from './types';
import { validateStep } from './validation';

export type SubmissionState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'submitting' }>
  | Readonly<{ status: 'success'; confirmation: BookingConfirmation }>
  | Readonly<{ status: 'error'; error: string }>;

export type BookingState = Readonly<{
  draft: BookingDraft;
  /**
   * Blocked "Next" presses on the current step. Errors are revealed once it is above 0 (not
   * while the user is still filling the step in), and each increment re-focuses the error summary.
   */
  failedNextAttempts: number;
  submission: SubmissionState;
}>;

export type BookingAction =
  | Readonly<{ type: 'eventSelected'; eventId: EventId | null }>
  | Readonly<{ type: 'dateChanged'; date: string }>
  | Readonly<{ type: 'seatToggled'; seatId: SeatId }>
  | Readonly<{ type: 'attendeeNameChanged'; seatId: SeatId; name: string }>
  | Readonly<{ type: 'nextRequested'; today: string }>
  | Readonly<{ type: 'backRequested' }>
  | Readonly<{ type: 'stepRequested'; step: BookingStep }>
  | Readonly<{ type: 'submitBlocked'; step: BookingStep }>
  | Readonly<{ type: 'submitStarted' }>
  | Readonly<{ type: 'submitSucceeded'; confirmation: BookingConfirmation }>
  | Readonly<{ type: 'submitFailed'; error: string }>
  | Readonly<{ type: 'reset' }>;

export const EMPTY_DRAFT: BookingDraft = {
  step: 'event',
  eventId: null,
  date: '',
  seatIds: [],
  attendees: {},
};

export function createBookingState(draft: BookingDraft): BookingState {
  return { draft, failedNextAttempts: 0, submission: { status: 'idle' } };
}

/** Keeps one attendee entry per selected seat, preserving names already typed. */
export function pickAttendees(seatIds: readonly SeatId[], attendees: Attendees): Attendees {
  const picked: Partial<Record<SeatId, string>> = {};
  for (const seatId of seatIds) {
    picked[seatId] = attendees[seatId] ?? '';
  }
  return picked;
}

function toggleSeat(draft: BookingDraft, seatId: SeatId): BookingDraft {
  const isSelected = draft.seatIds.includes(seatId);
  if (!isSelected && (isSeatBooked(seatId) || draft.seatIds.length >= MAX_SEATS_PER_BOOKING)) {
    return draft;
  }
  const seatIds = isSelected
    ? draft.seatIds.filter((selectedId) => selectedId !== seatId)
    : sortSeatIds([...draft.seatIds, seatId]);
  return { ...draft, seatIds, attendees: pickAttendees(seatIds, draft.attendees) };
}

function updateDraft(state: BookingState, draft: BookingDraft): BookingState {
  return draft === state.draft ? state : { ...state, draft };
}

function goToStep(state: BookingState, step: BookingStep): BookingState {
  // Navigating mid-submit would let the user edit a booking that is already being sent.
  if (state.submission.status === 'submitting') {
    return state;
  }
  // A failed submit's message belongs to that attempt; it shouldn't greet the user on return.
  return createBookingState({ ...state.draft, step });
}

/** Counts as a blocked attempt, which shows (and focuses) the errors for the current step. */
export function revealErrors(state: BookingState): BookingState {
  return { ...state, failedNextAttempts: state.failedNextAttempts + 1 };
}

export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  const { draft } = state;
  switch (action.type) {
    case 'eventSelected':
      return updateDraft(state, { ...draft, eventId: action.eventId });
    case 'dateChanged':
      return updateDraft(state, { ...draft, date: action.date });
    case 'seatToggled':
      return updateDraft(state, toggleSeat(draft, action.seatId));
    case 'attendeeNameChanged':
      if (!draft.seatIds.includes(action.seatId)) {
        return state;
      }
      return updateDraft(state, {
        ...draft,
        attendees: { ...draft.attendees, [action.seatId]: action.name },
      });
    case 'nextRequested':
      // The reducer, not the button, owns the rule "no advancing past an invalid step".
      if (validateStep(draft.step, draft, action.today).length > 0) {
        return revealErrors(state);
      }
      return goToStep(state, getNextStep(draft.step));
    case 'backRequested':
      return goToStep(state, getPreviousStep(draft.step));
    case 'stepRequested':
      // Only earlier steps can be jumped to; later ones must be reached through validation.
      return isStepBefore(action.step, draft.step) ? goToStep(state, action.step) : state;
    case 'submitBlocked':
      // The draft went stale on the review step (e.g. the date passed overnight). Return to the
      // first invalid step with its errors revealed, so the user sees why instead of a silent jump.
      return revealErrors(goToStep(state, action.step));
    case 'submitStarted':
      return { ...state, submission: { status: 'submitting' } };
    case 'submitSucceeded':
      // The confirmation carries what was booked, so the draft can be cleared straight away.
      return {
        ...createBookingState(EMPTY_DRAFT),
        submission: { status: 'success', confirmation: action.confirmation },
      };
    case 'submitFailed':
      return { ...state, submission: { status: 'error', error: action.error } };
    case 'reset':
      return createBookingState(EMPTY_DRAFT);
    default:
      return assertNever(action);
  }
}
