import type { JSX } from 'react';
import { MAX_SEATS_PER_BOOKING } from '../model/catalog';
import type { SeatId } from '../model/catalog';
import { formatPrice, getPriceBreakdown } from '../model/pricing';
import type { FieldError } from '../model/types';
import { findFieldError } from '../model/validation';
import { FieldErrorMessage } from './FieldErrorMessage';
import { getErrorId, getFieldId } from './fieldIds';
import { SeatGrid } from './SeatGrid';
import './SeatStep.css';

type SeatStepProps = Readonly<{
  seatIds: readonly SeatId[];
  errors: readonly FieldError[];
  onSeatToggle: (seatId: SeatId) => void;
}>;

export function SeatStep({ seatIds, errors, onSeatToggle }: SeatStepProps): JSX.Element {
  const seatError = findFieldError(errors, 'seats');
  const isAtLimit = seatIds.length >= MAX_SEATS_PER_BOOKING;
  const { totalCents } = getPriceBreakdown(seatIds);

  return (
    <fieldset
      id={getFieldId('seats')}
      // Focus target for the error summary link; not in the tab order.
      tabIndex={-1}
      className="seat-step"
      aria-describedby={seatError === undefined ? undefined : getErrorId('seats')}
    >
      <legend className="seat-step__legend">
        Choose 1 to {MAX_SEATS_PER_BOOKING} seats. Booked seats can’t be selected.
      </legend>
      <SeatGrid selectedSeatIds={seatIds} isAtLimit={isAtLimit} onSeatToggle={onSeatToggle} />
      <div className="seat-step__summary" role="status">
        <p className="seat-step__count">
          {seatIds.length} of {MAX_SEATS_PER_BOOKING} seats selected
          {seatIds.length > 0 && `: ${seatIds.join(', ')}`} · Total {formatPrice(totalCents)}
        </p>
        {isAtLimit && (
          <p className="seat-step__hint">
            You’ve reached the maximum of {MAX_SEATS_PER_BOOKING} seats. Deselect a seat to choose a
            different one.
          </p>
        )}
      </div>
      <FieldErrorMessage field="seats" message={seatError} />
    </fieldset>
  );
}
