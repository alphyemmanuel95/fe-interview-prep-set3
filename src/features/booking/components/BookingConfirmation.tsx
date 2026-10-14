import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { findEvent } from '../model/catalog';
import { formatIsoDate } from '../model/localDate';
import { formatPrice } from '../model/pricing';
import type { BookingConfirmation as Confirmation } from '../model/types';
import './BookingConfirmation.css';

type BookingConfirmationProps = Readonly<{
  confirmation: Confirmation;
  onBookAnother: () => void;
}>;

export function BookingConfirmation({
  confirmation,
  onBookAnother,
}: BookingConfirmationProps): JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { reference, booking } = confirmation;

  // The form the user was in has just been replaced, so move focus to the outcome.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="booking-confirmation" aria-labelledby="booking-confirmation-title">
      <h2
        id="booking-confirmation-title"
        ref={headingRef}
        tabIndex={-1}
        className="booking-confirmation__title"
      >
        Booking confirmed
      </h2>
      <p className="booking-confirmation__reference">
        Your reference is <strong>{reference}</strong>.
      </p>
      <dl className="booking-confirmation__details">
        <dt>Event</dt>
        <dd>{findEvent(booking.eventId)?.name}</dd>
        <dt>Date</dt>
        <dd>{formatIsoDate(booking.date)}</dd>
        <dt>Seats</dt>
        <dd>{booking.attendees.map((attendee) => attendee.seatId).join(', ')}</dd>
        <dt>Total paid</dt>
        <dd>{formatPrice(booking.totalCents)}</dd>
      </dl>
      <button type="button" className="booking-confirmation__button" onClick={onBookAnother}>
        Book another event
      </button>
    </section>
  );
}
