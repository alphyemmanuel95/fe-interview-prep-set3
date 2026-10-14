import type { JSX } from 'react';
import { EVENTS, isEventId } from '../model/catalog';
import type { EventId } from '../model/catalog';
import type { FieldError } from '../model/types';
import { findFieldError } from '../model/validation';
import { getControlProps } from './fieldIds';
import { FormField } from './FormField';
import './EventStep.css';

type EventStepProps = Readonly<{
  eventId: EventId | null;
  date: string;
  today: string;
  errors: readonly FieldError[];
  onEventChange: (eventId: EventId | null) => void;
  onDateChange: (date: string) => void;
}>;

export function EventStep({
  eventId,
  date,
  today,
  errors,
  onEventChange,
  onDateChange,
}: EventStepProps): JSX.Element {
  const eventError = findFieldError(errors, 'event');
  const dateError = findFieldError(errors, 'date');

  return (
    <div className="event-step">
      <FormField field="event" label="Event" error={eventError}>
        <select
          {...getControlProps('event', eventError)}
          value={eventId ?? ''}
          onChange={(changeEvent) => {
            const { value } = changeEvent.target;
            onEventChange(isEventId(value) ? value : null);
          }}
        >
          <option value="">Select an event</option>
          {EVENTS.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField field="date" label="Date" error={dateError}>
        <input
          {...getControlProps('date', dateError)}
          type="date"
          min={today}
          value={date}
          onChange={(changeEvent) => {
            onDateChange(changeEvent.target.value);
          }}
        />
      </FormField>
    </div>
  );
}
