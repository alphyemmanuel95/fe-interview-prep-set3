import type { JSX, MouseEvent, Ref } from 'react';
import type { BookingField, FieldError } from '../model/types';
import { getFieldId } from './fieldIds';
import './ErrorSummary.css';

type ErrorSummaryProps = Readonly<{
  errors: readonly FieldError[];
  /** The page focuses the summary after a blocked "Next"; the summary never focuses itself. */
  ref: Ref<HTMLElement>;
}>;

// A plain fragment link only scrolls; it doesn't reliably move focus into the control, and the
// hash would also go through the router. Focus the field directly instead (GOV.UK pattern).
function focusField(clickEvent: MouseEvent<HTMLAnchorElement>, field: BookingField): void {
  clickEvent.preventDefault();
  document.getElementById(getFieldId(field))?.focus();
}

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
          <li key={error.field}>
            <a
              href={`#${getFieldId(error.field)}`}
              className="error-summary__link"
              onClick={(clickEvent) => {
                focusField(clickEvent, error.field);
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
