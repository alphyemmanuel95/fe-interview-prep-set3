import type { JSX } from 'react';
import { getSeatTier, SEAT_TIERS } from '../model/catalog';
import type { SeatId } from '../model/catalog';
import type { Attendees, FieldError } from '../model/types';
import { findFieldError, getAttendeeField } from '../model/validation';
import { getControlProps } from './fieldIds';
import { FormField } from './FormField';
import './AttendeeStep.css';

type AttendeeStepProps = Readonly<{
  seatIds: readonly SeatId[];
  attendees: Attendees;
  errors: readonly FieldError[];
  onNameChange: (seatId: SeatId, name: string) => void;
}>;

export function AttendeeStep({
  seatIds,
  attendees,
  errors,
  onNameChange,
}: AttendeeStepProps): JSX.Element {
  return (
    <div className="attendee-step">
      <p className="attendee-step__intro">Enter one attendee name for each selected seat.</p>
      <ul className="attendee-step__list">
        {/* Keyed by seat id, so removing a seat unmounts exactly that seat's field. */}
        {seatIds.map((seatId) => {
          const field = getAttendeeField(seatId);
          const error = findFieldError(errors, field);
          return (
            <li key={seatId} className="attendee-step__item">
              <FormField
                field={field}
                label={`Attendee for seat ${seatId} (${SEAT_TIERS[getSeatTier(seatId)].label})`}
                error={error}
              >
                <input
                  {...getControlProps(field, error)}
                  type="text"
                  autoComplete="off"
                  value={attendees[seatId] ?? ''}
                  onChange={(changeEvent) => {
                    onNameChange(seatId, changeEvent.target.value);
                  }}
                />
              </FormField>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
