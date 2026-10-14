import type { Dispatch, JSX } from 'react';
import { assertNever } from '../../../shared/assertNever';
import type { BookingAction, SubmissionState } from '../model/bookingReducer';
import type { BookingDraft, FieldError } from '../model/types';
import { AttendeeStep } from './AttendeeStep';
import { EventStep } from './EventStep';
import { ReviewStep } from './ReviewStep';
import { SeatStep } from './SeatStep';

type BookingStepContentProps = Readonly<{
  draft: BookingDraft;
  submission: SubmissionState;
  errors: readonly FieldError[];
  today: string;
  dispatch: Dispatch<BookingAction>;
}>;

/** Maps the current step to its form; each step component stays unaware of the reducer. */
export function BookingStepContent({
  draft,
  submission,
  errors,
  today,
  dispatch,
}: BookingStepContentProps): JSX.Element {
  switch (draft.step) {
    case 'event':
      return (
        <EventStep
          eventId={draft.eventId}
          date={draft.date}
          today={today}
          errors={errors}
          onEventChange={(eventId) => {
            dispatch({ type: 'eventSelected', eventId });
          }}
          onDateChange={(date) => {
            dispatch({ type: 'dateChanged', date });
          }}
        />
      );
    case 'seats':
      return (
        <SeatStep
          seatIds={draft.seatIds}
          errors={errors}
          onSeatToggle={(seatId) => {
            dispatch({ type: 'seatToggled', seatId });
          }}
        />
      );
    case 'attendees':
      return (
        <AttendeeStep
          seatIds={draft.seatIds}
          attendees={draft.attendees}
          errors={errors}
          onNameChange={(seatId, name) => {
            dispatch({ type: 'attendeeNameChanged', seatId, name });
          }}
        />
      );
    case 'review':
      return (
        <ReviewStep
          draft={draft}
          submission={submission}
          onEditStep={(step) => {
            dispatch({ type: 'stepRequested', step });
          }}
        />
      );
    default:
      return assertNever(draft.step);
  }
}
