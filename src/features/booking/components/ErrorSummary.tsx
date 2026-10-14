import type { JSX, Ref } from 'react';
import type { FieldError } from '../model/types';
import './ErrorSummary.css';

type ErrorSummaryProps = Readonly<{
  errors: readonly FieldError[];
  /** The page focuses the summary after a blocked "Next"; the summary never focuses itself. */
  ref: Ref<HTMLDivElement>;
}>;

export function ErrorSummary({ errors, ref }: ErrorSummaryProps): JSX.Element {
  return (
    <div
      ref={ref}
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
