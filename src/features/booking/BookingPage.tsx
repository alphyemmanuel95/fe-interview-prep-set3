import type { JSX, SubmitEvent } from 'react';
import { assertNever } from '../../shared/assertNever';
import { AttendeeStep } from './components/AttendeeStep';
import { BookingProgress } from './components/BookingProgress';
import { ErrorSummary } from './components/ErrorSummary';
import { EventStep } from './components/EventStep';
import { SeatStep } from './components/SeatStep';
import { useBookingDraft } from './hooks/useBookingDraft';
import { useFocusOnChange } from './hooks/useFocusOnChange';
import { useLocalToday } from './hooks/useLocalToday';
import { BOOKING_STEPS, getStepNumber, STEP_LABELS } from './model/steps';
import { validateStep } from './model/validation';
import './BookingPage.css';

export function BookingPage(): JSX.Element {
  const today = useLocalToday();
  const [state, dispatch] = useBookingDraft();
  const { draft, failedNextAttempts } = state;
  const stepHeadingRef = useFocusOnChange<HTMLHeadingElement>(draft.step);
  // Errors are derived from the live draft, so fixing a field clears its message immediately.
  const errors = failedNextAttempts > 0 ? validateStep(draft.step, draft, today) : [];

  function handleSubmit(submitEvent: SubmitEvent<HTMLFormElement>): void {
    submitEvent.preventDefault();
    dispatch({ type: 'nextRequested', today });
  }

  function renderStep(): JSX.Element | null {
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
        return null;
      default:
        return assertNever(draft.step);
    }
  }

  return (
    <section className="booking" aria-labelledby="booking-title">
      <h1 id="booking-title" className="booking__title">
        Book an event
      </h1>
      <BookingProgress currentStep={draft.step} isComplete={false} />
      <form
        className="booking__panel"
        aria-labelledby="booking-step-title"
        noValidate
        onSubmit={handleSubmit}
      >
        <h2
          id="booking-step-title"
          ref={stepHeadingRef}
          tabIndex={-1}
          className="booking__step-title"
        >
          <span className="booking__step-count">
            Step {getStepNumber(draft.step)} of {BOOKING_STEPS.length}
          </span>{' '}
          {STEP_LABELS[draft.step]}
        </h2>
        {errors.length > 0 && <ErrorSummary errors={errors} focusKey={failedNextAttempts} />}
        {renderStep()}
        <div className="booking__actions">
          {draft.step !== 'event' && (
            <button
              type="button"
              className="booking__button booking__button--secondary"
              onClick={() => {
                dispatch({ type: 'backRequested' });
              }}
            >
              Back
            </button>
          )}
          <button type="submit" className="booking__button booking__button--primary">
            Next
          </button>
        </div>
      </form>
    </section>
  );
}
