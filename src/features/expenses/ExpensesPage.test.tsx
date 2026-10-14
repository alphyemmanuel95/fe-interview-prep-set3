import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';

type NewExpense = Readonly<{ title: string; amount: string; category: string; date: string }>;

const LUNCH: NewExpense = { title: 'Lunch', amount: '0.10', category: 'Food', date: '2026-10-03' };
const TAXI: NewExpense = { title: 'Taxi', amount: '0.20', category: 'Travel', date: '2026-10-05' };

function renderPage(url: string): Readonly<{
  router: ReturnType<typeof createMemoryRouter>;
  unmount: () => void;
}> {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const { unmount } = render(<RouterProvider router={router} />);
  return { router, unmount };
}

const filters = (): HTMLElement => screen.getByRole('group', { name: 'Filters' });

async function addExpense(user: UserEvent, expense: NewExpense): Promise<void> {
  const form = screen.getByRole('form', { name: 'Add expense' });
  await user.type(within(form).getByLabelText('Title'), expense.title);
  await user.type(within(form).getByLabelText('Amount'), expense.amount);
  await user.selectOptions(within(form).getByLabelText('Category'), expense.category);
  const date = within(form).getByLabelText('Date');
  await user.clear(date);
  await user.type(date, expense.date);
  await user.click(within(form).getByRole('button', { name: 'Add expense' }));
}

const monthTotal = (): HTMLElement => screen.getByRole('status', { name: 'Month total' });
const breakdownRow = (name: string): HTMLElement =>
  within(screen.getByRole('table', { name: 'By category' })).getByRole('row', { name });

afterEach(() => {
  vi.useRealTimers();
});

describe('ExpensesPage', () => {
  it('updates the monthly total and category breakdown immediately when an amount is edited', async () => {
    const user = userEvent.setup();
    renderPage('/expenses?month=2026-10');

    await addExpense(user, LUNCH);
    await addExpense(user, TAXI);

    expect(monthTotal()).toHaveTextContent('0.30');
    expect(breakdownRow('Food 0.10')).toBeInTheDocument();
    expect(breakdownRow('Travel 0.20')).toBeInTheDocument();
    expect(breakdownRow('Bills 0.00')).toBeInTheDocument();
    expect(breakdownRow('Other 0.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit Lunch' }));
    const editForm = screen.getByRole('form', { name: 'Edit expense' });
    const amount = within(editForm).getByLabelText('Amount');
    expect(amount).toHaveValue('0.10');
    await user.clear(amount);
    await user.type(amount, '5.25');
    await user.click(within(editForm).getByRole('button', { name: 'Save changes' }));

    expect(monthTotal()).toHaveTextContent('5.45');
    expect(breakdownRow('Food 5.25')).toBeInTheDocument();
    expect(breakdownRow('Travel 0.20')).toBeInTheDocument();
    // Focus returns to the edited row rather than jumping to the top of the list.
    expect(screen.getByRole('button', { name: 'Edit Lunch' })).toHaveFocus();
    expect(screen.getByRole('form', { name: 'Add expense' })).toBeInTheDocument();
  });

  it('blocks submit and shows inline errors for an empty title and an invalid amount', async () => {
    const user = userEvent.setup();
    renderPage('/expenses?month=2026-10');
    const form = screen.getByRole('form', { name: 'Add expense' });
    const title = within(form).getByLabelText('Title');
    const amount = within(form).getByLabelText('Amount');

    await user.type(title, '   ');
    await user.type(amount, '-5');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));

    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('Enter a title.');
    expect(title).toHaveFocus();
    expect(amount).toHaveAccessibleDescription('Enter an amount like 12.50.');

    for (const invalid of ['0', 'abc', '']) {
      await user.clear(amount);
      if (invalid !== '') {
        await user.type(amount, invalid);
      }
      await user.click(within(form).getByRole('button', { name: 'Add expense' }));
      expect(amount).toHaveAttribute('aria-invalid', 'true');
    }

    expect(screen.getByText('No expenses yet — add one above.')).toBeInTheDocument();
    expect(monthTotal()).toHaveTextContent('0.00');
  });

  it('restores expenses and filters after the page is unmounted and opened again', async () => {
    const user = userEvent.setup();
    const { router, unmount } = renderPage('/expenses?month=2026-10');
    await addExpense(user, LUNCH);
    await addExpense(user, TAXI);
    await user.selectOptions(within(filters()).getByLabelText('Category'), 'Food');
    expect(router.state.location.search).toBe('?month=2026-10&category=Food');

    // Reopen at the same URL, as a refresh or a shared link would.
    const { pathname, search } = router.state.location;
    unmount();
    renderPage(`${pathname}${search}`);

    const list = within(screen.getByRole('region', { name: 'Expenses' })).getByRole('list');
    expect(within(list).getByText('Lunch')).toBeInTheDocument();
    expect(within(list).queryByText('Taxi')).not.toBeInTheDocument();
    expect(within(filters()).getByLabelText('Month')).toHaveValue('2026-10');
    expect(within(filters()).getByLabelText('Category')).toHaveValue('Food');
    // The summary covers the whole month, whatever category the list is filtered to.
    expect(monthTotal()).toHaveTextContent('0.30');
  });

  it('explains an empty filtered list and offers to show all categories', async () => {
    const user = userEvent.setup();
    renderPage('/expenses?month=2026-10');
    await addExpense(user, LUNCH);

    await user.selectOptions(within(filters()).getByLabelText('Category'), 'Bills');
    expect(screen.getByText('No Bills expenses in October 2026.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all categories' }));
    expect(within(filters()).getByLabelText('Category')).toHaveValue('all');
    expect(screen.getByRole('button', { name: 'Edit Lunch' })).toBeInTheDocument();
  });

  it('adds a new expense into the viewed month and category and says where it went', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14));
    const user = userEvent.setup();
    renderPage('/expenses?month=2026-03&category=Travel');
    const form = screen.getByRole('form', { name: 'Add expense' });
    expect(within(form).getByLabelText('Date')).toHaveValue('2026-03-01');
    expect(within(form).getByLabelText('Category')).toHaveValue('Travel');

    await user.type(within(form).getByLabelText('Title'), 'Taxi');
    await user.type(within(form).getByLabelText('Amount'), '12');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));

    expect(within(form).getByRole('status')).toHaveTextContent('Added Taxi to March 2026.');
    expect(screen.getByRole('button', { name: 'Edit Taxi' })).toBeInTheDocument();

    // A category the user has not picked follows the filter while the form is open.
    await user.selectOptions(within(filters()).getByLabelText('Category'), 'all');
    expect(within(form).getByLabelText('Category')).toHaveValue('Food');
  });

  it('removes a deleted expense from the list and the totals', async () => {
    const user = userEvent.setup();
    renderPage('/expenses?month=2026-10');
    await addExpense(user, LUNCH);
    await addExpense(user, TAXI);

    await user.click(screen.getByRole('button', { name: 'Delete Lunch' }));

    expect(screen.queryByRole('button', { name: 'Edit Lunch' })).not.toBeInTheDocument();
    expect(monthTotal()).toHaveTextContent('0.20');
    expect(breakdownRow('Food 0.00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Expenses' })).toHaveFocus();
  });

  it('steps the month filter with the previous and next buttons', async () => {
    const user = userEvent.setup();
    const { router } = renderPage('/expenses?month=2026-01');

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(within(filters()).getByLabelText('Month')).toHaveValue('2025-12');
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(router.state.location.search).toBe('?month=2026-02');
  });

  it('falls back to the current month and all categories for invalid URL filters', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14));
    renderPage('/expenses?month=2026-13&category=Gifts');

    expect(within(filters()).getByLabelText('Month')).toHaveValue('2026-10');
    expect(within(filters()).getByLabelText('Category')).toHaveValue('all');
  });
});
