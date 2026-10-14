import type { JSX } from 'react';
import { BOOKING_STEPS, isStepBefore, STEP_LABELS } from '../model/steps';
import type { BookingStep } from '../model/steps';
import './BookingProgress.css';

type BookingProgressProps = Readonly<{ currentStep: BookingStep; isComplete: boolean }>;

type StepState = 'complete' | 'current' | 'upcoming';

function getStepState(step: BookingStep, currentStep: BookingStep, isComplete: boolean): StepState {
  if (isComplete || isStepBefore(step, currentStep)) {
    return 'complete';
  }
  return step === currentStep ? 'current' : 'upcoming';
}

export function BookingProgress({ currentStep, isComplete }: BookingProgressProps): JSX.Element {
  return (
    <ol className="booking-progress" aria-label="Booking progress">
      {BOOKING_STEPS.map((step, index) => {
        const stepState = getStepState(step, currentStep, isComplete);
        return (
          <li
            key={step}
            className={`booking-progress__step booking-progress__step--${stepState}`}
            aria-current={stepState === 'current' ? 'step' : undefined}
          >
            <span className="booking-progress__marker" aria-hidden="true">
              {stepState === 'complete' ? '✓' : index + 1}
            </span>
            <span className="booking-progress__label">
              {STEP_LABELS[step]}
              {stepState === 'complete' && <span className="visually-hidden"> (completed)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
