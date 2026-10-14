export const BOOKING_STEPS = ['event', 'seats', 'attendees', 'review'] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

export const STEP_LABELS = {
  event: 'Event & date',
  seats: 'Seats',
  attendees: 'Attendees',
  review: 'Review',
} as const satisfies Record<BookingStep, string>;

export function getStepNumber(step: BookingStep): number {
  return BOOKING_STEPS.indexOf(step) + 1;
}

export function isStepBefore(step: BookingStep, reference: BookingStep): boolean {
  return BOOKING_STEPS.indexOf(step) < BOOKING_STEPS.indexOf(reference);
}

export function getNextStep(step: BookingStep): BookingStep {
  return BOOKING_STEPS[BOOKING_STEPS.indexOf(step) + 1] ?? step;
}

export function getPreviousStep(step: BookingStep): BookingStep {
  return BOOKING_STEPS[BOOKING_STEPS.indexOf(step) - 1] ?? step;
}

export function isBookingStep(value: string): value is BookingStep {
  return BOOKING_STEPS.some((step) => step === value);
}
