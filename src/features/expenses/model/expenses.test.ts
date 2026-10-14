import { describe, expect, it } from 'vitest';
import {
  type Expense,
  type ExpenseDraft,
  expensesReducer,
  isExpenseList,
  isIsoDate,
  selectMonthTotals,
  selectVisibleExpenses,
  toMonthKey,
  validateExpense,
} from './expenses';

const lunch: Expense = {
  id: 'a',
  title: 'Lunch',
  amountCents: 10,
  category: 'Food',
  date: '2026-10-03',
};
const taxi: Expense = {
  id: 'b',
  title: 'Taxi',
  amountCents: 20,
  category: 'Travel',
  date: '2026-10-05',
};
const rent: Expense = {
  id: 'c',
  title: 'Rent',
  amountCents: 90_000,
  category: 'Bills',
  date: '2026-09-01',
};

describe('expensesReducer', () => {
  it('adds an expense', () => {
    expect(expensesReducer([lunch], { type: 'added', expense: taxi })).toEqual([lunch, taxi]);
  });

  it('updates only the matching expense and keeps its id', () => {
    const draft: ExpenseDraft = {
      title: 'Lunch',
      amountCents: 525,
      category: 'Food',
      date: '2026-10-03',
    };
    expect(expensesReducer([lunch, taxi], { type: 'updated', id: 'a', draft })).toEqual([
      { ...lunch, amountCents: 525 },
      taxi,
    ]);
  });

  it('deletes by id', () => {
    expect(expensesReducer([lunch, taxi], { type: 'deleted', id: 'a' })).toEqual([taxi]);
  });
});

describe('selectMonthTotals', () => {
  it('totals only the selected month and lists every category, including empty ones', () => {
    expect(selectMonthTotals([lunch, taxi, rent], '2026-10')).toEqual({
      totalCents: 30,
      byCategory: [
        { category: 'Food', totalCents: 10 },
        { category: 'Travel', totalCents: 20 },
        { category: 'Bills', totalCents: 0 },
        { category: 'Other', totalCents: 0 },
      ],
    });
  });

  it('reflects an edited amount', () => {
    const edited = expensesReducer([lunch, taxi], {
      type: 'updated',
      id: 'a',
      draft: { title: 'Lunch', amountCents: 525, category: 'Food', date: '2026-10-03' },
    });
    const totals = selectMonthTotals(edited, '2026-10');
    expect(totals.totalCents).toBe(545);
    expect(totals.byCategory[0]).toEqual({ category: 'Food', totalCents: 525 });
  });
});

describe('selectVisibleExpenses', () => {
  it('filters by month and category, newest first', () => {
    const all = [lunch, taxi, rent];
    expect(selectVisibleExpenses(all, { month: '2026-10', category: 'all' })).toEqual([
      taxi,
      lunch,
    ]);
    expect(selectVisibleExpenses(all, { month: '2026-10', category: 'Food' })).toEqual([lunch]);
    expect(selectVisibleExpenses(all, { month: '2026-09', category: 'Food' })).toEqual([]);
  });
});

describe('validateExpense', () => {
  it('returns a trimmed draft in cents for valid input', () => {
    expect(
      validateExpense({ title: '  Lunch ', amount: '0.10', category: 'Food', date: '2026-10-03' }),
    ).toEqual({
      status: 'valid',
      draft: { title: 'Lunch', amountCents: 10, category: 'Food', date: '2026-10-03' },
    });
  });

  it('reports every invalid field', () => {
    expect(validateExpense({ title: '   ', amount: '-1', category: 'Food', date: '' })).toEqual({
      status: 'invalid',
      errors: {
        title: 'Enter a title.',
        amount: 'Enter a positive number with up to 2 decimals.',
        date: 'Enter a valid date.',
      },
    });
  });
});

describe('guards and dates', () => {
  it('rejects impossible calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
  });

  it('accepts only well-formed expense lists', () => {
    expect(isExpenseList([lunch, taxi])).toBe(true);
    expect(isExpenseList([{ ...lunch, category: 'Gifts' }])).toBe(false);
    expect(isExpenseList([{ ...lunch, amountCents: 1.5 }])).toBe(false);
    expect(isExpenseList({ lunch })).toBe(false);
  });

  it('builds month keys in local time', () => {
    expect(toMonthKey(new Date(2026, 0, 31))).toBe('2026-01');
  });
});
