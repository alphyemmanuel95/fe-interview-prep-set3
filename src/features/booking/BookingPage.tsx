import type { JSX, SubmitEvent } from 'react';
import { BookingConfirmation } from './components/BookingConfirmation';
import { BookingProgress } from './components/BookingProgress';
import { BookingStepContent } from './components/BookingStepContent';
import { ErrorSummary } from './components/ErrorSummary';
import { useBookingDraft } from './hooks/useBookingDraft';
import { useBookingSubmission } from './hooks/useBookingSubmission';
import { useFocusOnChange } from './hooks/useFocusOnChange';
import { useFocusOnIncrease } from './hooks/useFocusOnIncrease';
import { useLocalToday } from './hooks/useLocalToday';
import { prepareBookingRequest } from './model/bookingRequest';
import { BOOKING_STEPS, getStepNumber, STEP_LABELS } from './model/steps';
import type { BookingStep } from './model/steps';
import { validateStep } from './model/validation';
import './BookingPage.css';

function getPrimaryActionLabel(step: BookingStep, isSubmitting: boolean): string {
  if (step !== 'review') {
    return 'Next';
  }
  return isSubmitting ? 'Submitting…' : 'Confirm booking';
}

export function BookingPage(): JSX.Element {
  const [today, refreshToday] = useLocalToday();
  const [state, dispatch] = useBookingDraft(today);
  const submit = useBookingSubmission(dispatch);
  const { draft, failedNextAttempts, submission } = state;
  const stepHeadingRef = useFocusOnChange<HTMLHeadingElement>(draft.step);
  // Declared after the heading focus so that, when both fire together, the error summary wins.
  const errorSummaryRef = useFocusOnIncrease<HTMLElement>(failedNextAttempts);
  // Errors are derived from the live draft, so fixing a field clears its message immediately.
  const errors = failedNextAttempts > 0 ? validateStep(draft.step, draft, today) : [];
  const isSubmitting = submission.status === 'submitting';

  function confirmBooking(): void {
    const prepared = prepareBookingRequest(draft, refreshToday());
    if (prepared.status === 'invalid') {
      dispatch({ type: 'submitBlocked', step: prepared.step });
      return;
    }
    submit(prepared.request);
  }

  // A real <form> means Enter in any field advances the step, just like the Next button.
  function handleSubmit(submitEvent: SubmitEvent<HTMLFormElement>): void {
    submitEvent.preventDefault();
    if (draft.step === 'review') {
      confirmBooking();
    } else {
      // The gates read the clock at the moment of the action rather than trusting rendered state.
      dispatch({ type: 'nextRequested', today: refreshToday() });
    }
  }

  return (
    <section className="booking" aria-labelledby="booking-title">
      <h1 id="booking-title" className="booking__title">
        Book an event
      </h1>
      <BookingProgress currentStep={draft.step} isComplete={submission.status === 'success'} />
      {submission.status === 'success' ? (
        <BookingConfirmation
          confirmation={submission.confirmation}
          onBookAnother={() => {
            dispatch({ type: 'reset' });
          }}
        />
      ) : (
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
          {errors.length > 0 && <ErrorSummary ref={errorSummaryRef} errors={errors} />}
          <BookingStepContent
            draft={draft}
            submission={submission}
            errors={errors}
            today={today}
            dispatch={dispatch}
          />
          <div className="booking__actions">
            {draft.step !== 'event' && (
              <button
                type="button"
                className="booking__button booking__button--secondary"
                disabled={isSubmitting}
                onClick={() => {
                  dispatch({ type: 'backRequested' });
                }}
              >
                Back
              </button>
            )}
            <button
              type="submit"
              className="booking__button booking__button--primary"
              disabled={isSubmitting}
            >
              {getPrimaryActionLabel(draft.step, isSubmitting)}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
