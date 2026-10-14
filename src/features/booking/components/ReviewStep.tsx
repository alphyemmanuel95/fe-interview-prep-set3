import type { JSX } from 'react';
import type { SubmissionState } from '../model/bookingReducer';
import { getEventName, getSeatPriceCents, getSeatTier, SEAT_TIERS } from '../model/catalog';
import { formatIsoDate } from '../model/localDate';
import { formatPrice } from '../model/pricing';
import type { BookingStep } from '../model/steps';
import type { BookingDraft } from '../model/types';
import { PriceBreakdownTable } from './PriceBreakdownTable';
import { ReviewSection } from './ReviewSection';
import './ReviewStep.css';

type ReviewStepProps = Readonly<{
  draft: BookingDraft;
  submission: SubmissionState;
  onEditStep: (step: BookingStep) => void;
}>;

export function ReviewStep({ draft, submission, onEditStep }: ReviewStepProps): JSX.Element {
  const isSubmitting = submission.status === 'submitting';

  return (
    <div className="review-step">
      <ReviewSection
        id="review-event"
        title="Event & date"
        editLabel="event and date"
        isEditDisabled={isSubmitting}
        onEdit={() => {
          onEditStep('event');
        }}
      >
        <dl className="review-step__details">
          <dt>Event</dt>
          <dd>{getEventName(draft.eventId)}</dd>
          <dt>Date</dt>
          <dd>{formatIsoDate(draft.date)}</dd>
        </dl>
      </ReviewSection>
      <ReviewSection
        id="review-seats"
        title="Seats"
        editLabel="seats"
        isEditDisabled={isSubmitting}
        onEdit={() => {
          onEditStep('seats');
        }}
      >
        <ul className="review-step__seats">
          {draft.seatIds.map((seatId) => (
            <li key={seatId}>
              {seatId} · {SEAT_TIERS[getSeatTier(seatId)].label} ·{' '}
              {formatPrice(getSeatPriceCents(seatId))}
            </li>
          ))}
        </ul>
      </ReviewSection>
      <ReviewSection
        id="review-attendees"
        title="Attendees"
        editLabel="attendees"
        isEditDisabled={isSubmitting}
        onEdit={() => {
          onEditStep('attendees');
        }}
      >
        <dl className="review-step__details">
          {draft.seatIds.map((seatId) => (
            <div key={seatId} className="review-step__detail">
              <dt>Seat {seatId}</dt>
              <dd>{draft.attendees[seatId]}</dd>
            </div>
          ))}
        </dl>
      </ReviewSection>
      <section className="review-step__price" aria-labelledby="review-price-title">
        <h3 id="review-price-title" className="review-step__price-title">
          Price
        </h3>
        <PriceBreakdownTable seatIds={draft.seatIds} />
      </section>
      <p className="review-step__status" role="status">
        {isSubmitting ? 'Submitting your booking…' : ''}
      </p>
      {submission.status === 'error' && (
        <p className="review-step__error" role="alert">
          {submission.error}
        </p>
      )}
    </div>
  );
}
