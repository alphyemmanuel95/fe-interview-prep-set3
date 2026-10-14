import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { FieldError } from '../model/types';
import './ErrorSummary.css';

type ErrorSummaryProps = Readonly<{
  errors: readonly FieldError[];
  /** Changes on every blocked "Next" so focus returns here even if the summary is already shown. */
  focusKey: number;
}>;

export function ErrorSummary({ errors, focusKey }: ErrorSummaryProps): JSX.Element {
  const summaryRef = useRef<HTMLDivElement>(null);

  // Moving focus to the summary tells keyboard and screen reader users why nothing happened.
  useEffect(() => {
    summaryRef.current?.focus();
  }, [focusKey]);

  return (
    <div
      ref={summaryRef}
      className="error-summary"
      role="alert"
      tabIndex={-1}
      aria-labelledby="booking-error-summary-title"
    >
      <h3 id="booking-error-summary-title" className="error-summary__title">
        Fix the following to continue
      </h3>
      <ul className="error-summary__list">
        {errors.map((error) => (
          <li key={error.field}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}
