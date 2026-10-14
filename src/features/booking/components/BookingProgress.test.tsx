import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingProgress } from './BookingProgress';

describe('BookingProgress', () => {
  it('marks completed steps and the current step for assistive technology', () => {
    render(<BookingProgress currentStep="attendees" isComplete={false} />);

    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('Event & date (completed)');
    expect(steps[2]).toHaveAttribute('aria-current', 'step');
  });
});
