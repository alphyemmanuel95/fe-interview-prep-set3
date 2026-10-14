import type { JSX, Ref } from 'react';
import type { FieldError } from '../model/types';
import './ErrorSummary.css';

type ErrorSummaryProps = Readonly<{
  errors: readonly FieldError[];
  /** The page focuses the summary after a blocked "Next"; the summary never focuses itself. */
  ref: Ref<HTMLElement>;
}>;

// No role="alert": focus moves here after a blocked Next, which already makes screen readers read
// it. A live region on top would announce the same content twice.
export function ErrorSummary({ errors, ref }: ErrorSummaryProps): JSX.Element {
  return (
    <section
      ref={ref}
      className="error-summary"
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
    </section>
  );
}
