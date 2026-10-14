import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIMULATED_LATENCY_MS } from './api/submitBooking';
import { BookingPage } from './BookingPage';

// Local noon on 14 Oct 2026, so "today" is deterministic whatever the machine's clock says.
const NOW = new Date(2026, 9, 14, 12);
const FUTURE_DATE = '2026-10-20';

type Setup = Readonly<{ user: UserEvent; reload: () => void }>;

function setup(): Setup {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  let { unmount } = render(<BookingPage />);
  // Unmounting and mounting again is what a page refresh does to the component; storage remains.
  function reload(): void {
    unmount();
    ({ unmount } = render(<BookingPage />));
  }
  return { user, reload };
}

function getStepHeading(): HTMLElement {
  return screen.getByRole('heading', { level: 2 });
}

function getSeat(seatId: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Seat ${seatId},`) });
}

async function clickNext(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

async function completeEventStep(user: UserEvent): Promise<void> {
  await user.selectOptions(screen.getByLabelText('Event'), 'Jazz Night');
  await user.type(screen.getByLabelText('Date'), FUTURE_DATE);
  await clickNext(user);
}

async function selectSeats(user: UserEvent, seatIds: readonly string[]): Promise<void> {
  for (const seatId of seatIds) {
    await user.click(getSeat(seatId));
  }
}

describe('BookingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks Next on an invalid step and shows clear errors', async () => {
    const { user } = setup();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await clickNext(user);

    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    expect(within(summary).getByText('Choose an event.')).toBeInTheDocument();
    expect(within(summary).getByText('Choose a date.')).toBeInTheDocument();
    expect(getStepHeading()).toHaveTextContent('Event & date');
    expect(screen.getByLabelText('Event')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Event')).toHaveAccessibleDescription('Error: Choose an event.');
  });

  it('keeps focus in the field while the error summary disappears and returns', async () => {
    const { user } = setup();
    await completeEventStep(user);
    await selectSeats(user, ['A1']);
    await clickNext(user);
    await clickNext(user);
    const nameInput = screen.getByLabelText(/seat A1/);

    await user.click(nameInput);
    await user.type(nameInput, 'A');
    expect(screen.queryByText('Fix the following to continue')).not.toBeInTheDocument();
    await user.type(nameInput, '{Backspace}');

    expect(screen.getByText('Fix the following to continue')).toBeInTheDocument();
    expect(nameInput).toHaveFocus();
  });

  it('rejects a past date', async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText('Event'), 'Jazz Night');
    await user.type(screen.getByLabelText('Date'), '2026-10-13');

    await clickNext(user);

    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription(
      'Error: Choose today or a future date.',
    );
    expect(getStepHeading()).toHaveTextContent('Event & date');
  });

  it('requires at least one seat and caps the selection at six', async () => {
    const { user } = setup();
    await completeEventStep(user);

    await clickNext(user);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least 1 seat.');

    expect(getSeat('A4')).toBeDisabled();
    await selectSeats(user, ['A1', 'A2', 'A3', 'A6', 'A7', 'A8']);

    expect(getSeat('C1')).toBeDisabled();
    expect(getSeat('A8')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/reached the maximum of 6 seats/)).toBeInTheDocument();
  });

  it('updates attendee fields and the total when seats change', async () => {
    const { user } = setup();
    await completeEventStep(user);
    await selectSeats(user, ['A1', 'C1']);
    expect(screen.getByRole('status')).toHaveTextContent('Total ₹750.00');
    await clickNext(user);
    await user.type(screen.getByLabelText(/seat A1/), 'Asha');
    await user.type(screen.getByLabelText(/seat C1/), 'Chen');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(getSeat('A1'));
    await user.click(getSeat('B1'));
    expect(screen.getByRole('status')).toHaveTextContent('Total ₹750.00');
    await user.click(getSeat('D2'));
    expect(screen.getByRole('status')).toHaveTextContent('Total ₹1,000.00');
    await clickNext(user);

    expect(screen.queryByLabelText(/seat A1/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/seat B1/)).toHaveValue('');
    expect(screen.getByLabelText(/seat C1/)).toHaveValue('Chen');
    expect(screen.getByLabelText(/seat D2/)).toHaveValue('');
  });

  it('reviews the booking, edits a step and submits successfully', async () => {
    const { user } = setup();
    await completeEventStep(user);
    await selectSeats(user, ['A1', 'B3', 'C1']);
    await clickNext(user);
    await user.type(screen.getByLabelText(/seat A1/), 'Asha');
    await user.type(screen.getByLabelText(/seat B3/), 'Ben');
    await clickNext(user);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the attendee name for seat C1.');
    await user.type(screen.getByLabelText(/seat C1/), 'Chen');
    await clickNext(user);

    expect(getStepHeading()).toHaveTextContent('Review');
    const priceTable = screen.getByRole('table', { name: 'Price breakdown' });
    expect(within(priceTable).getByRole('row', { name: /VIP 2 ₹500.00 ₹1,000.00/ })).toBeVisible();
    expect(within(priceTable).getByRole('row', { name: /Standard 1 ₹250.00/ })).toBeVisible();
    expect(within(priceTable).getByRole('row', { name: /Total ₹1,250.00/ })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Edit attendees' }));
    expect(getStepHeading()).toHaveTextContent('Attendees');
    expect(screen.getByLabelText(/seat B3/)).toHaveValue('Ben');
    await clickNext(user);

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(SIMULATED_LATENCY_MS));

    expect(screen.getByRole('heading', { name: /Booking confirmed/ })).toHaveFocus();
    expect(screen.getByText('A1, B3, C1')).toBeInTheDocument();
    expect(screen.getByText('₹1,250.00')).toBeInTheDocument();
  });

  it('explains why Confirm returned to an earlier step when the date went stale', async () => {
    const { user } = setup();
    await completeEventStep(user);
    await selectSeats(user, ['C1']);
    await clickNext(user);
    await user.type(screen.getByLabelText(/seat C1/), 'Chen');
    await clickNext(user);
    expect(getStepHeading()).toHaveTextContent('Review');

    vi.setSystemTime(new Date(2026, 9, 21, 12));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(getStepHeading()).toHaveTextContent('Event & date');
    expect(screen.getByText('Fix the following to continue').closest('[tabindex]')).toHaveFocus();
    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription(
      'Error: Choose today or a future date.',
    );
  });

  it('explains why a restored draft resumes at an earlier step', async () => {
    const { user, reload } = setup();
    await completeEventStep(user);
    await selectSeats(user, ['C1']);
    expect(getStepHeading()).toHaveTextContent('Seats');

    vi.setSystemTime(new Date(2026, 9, 21, 12));
    reload();

    expect(getStepHeading()).toHaveTextContent('Event & date');
    expect(screen.getByText('Fix the following to continue')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription(
      'Error: Choose today or a future date.',
    );
  });

  it('restores progress after a reload and clears it after booking', async () => {
    const { user, reload } = setup();
    await completeEventStep(user);
    await selectSeats(user, ['A1']);
    await clickNext(user);
    await user.type(screen.getByLabelText(/seat A1/), 'Asha');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    reload();

    expect(getStepHeading()).toHaveTextContent('Seats');
    expect(getSeat('A1')).toHaveAttribute('aria-pressed', 'true');
    await clickNext(user);
    expect(screen.getByLabelText(/seat A1/)).toHaveValue('Asha');
    await clickNext(user);
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    await act(() => vi.advanceTimersByTimeAsync(SIMULATED_LATENCY_MS));
    expect(screen.getByRole('heading', { name: /Booking confirmed/ })).toBeInTheDocument();

    reload();
    expect(getStepHeading()).toHaveTextContent('Event & date');
    expect(screen.getByLabelText('Event')).toHaveValue('');
  });
});
