import { assertNever } from '../../shared/assertNever';
import { parseAmountToCents } from './money';

// Single source of truth for categories: adding one here updates the form, filter and breakdown.
export const CATEGORIES = ['Food', 'Travel', 'Bills', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const ALL_CATEGORIES = 'all';
export type CategoryFilter = Category | typeof ALL_CATEGORIES;

/** Calendar month as `YYYY-MM`. */
export type MonthKey = string;

export type Expense = Readonly<{
  id: string;
  title: string;
  amountCents: number;
  category: Category;
  /** Calendar date as `YYYY-MM-DD`; kept as a string so it never shifts with time zones. */
  date: string;
}>;

export type ExpenseDraft = Omit<Expense, 'id'>;

export type ExpensesAction =
  | { type: 'added'; expense: Expense }
  | { type: 'updated'; id: string; draft: ExpenseDraft }
  | { type: 'deleted'; id: string };

export function expensesReducer(
  state: readonly Expense[],
  action: ExpensesAction,
): readonly Expense[] {
  switch (action.type) {
    case 'added':
      return [...state, action.expense];
    case 'updated':
      return state.map((expense) =>
        expense.id === action.id ? { ...action.draft, id: action.id } : expense,
      );
    case 'deleted':
      return state.filter((expense) => expense.id !== action.id);
    default:
      return assertNever(action);
  }
}

// ---- Guards (localStorage and URL values are untrusted) ----

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;
const MONTH_KEY_LENGTH = 'YYYY-MM'.length;

export const isCategory = (value: unknown): value is Category =>
  CATEGORIES.some((category) => category === value);

export const isCategoryFilter = (value: unknown): value is CategoryFilter =>
  value === ALL_CATEGORIES || isCategory(value);

export const isMonthKey = (value: unknown): value is MonthKey =>
  typeof value === 'string' && MONTH_PATTERN.test(value);

// The round trip rejects impossible dates such as 2026-02-30, which the pattern alone accepts.
export const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  DATE_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, ISO_DATE_LENGTH) === value;

const isExpense = (value: unknown): value is Expense =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'title' in value &&
  typeof value.title === 'string' &&
  'amountCents' in value &&
  Number.isSafeInteger(value.amountCents) &&
  'category' in value &&
  isCategory(value.category) &&
  'date' in value &&
  isIsoDate(value.date);

export const isExpenseList = (value: unknown): value is readonly Expense[] =>
  Array.isArray(value) && value.every(isExpense);

// ---- Dates ----

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const monthOf = (isoDate: string): MonthKey => isoDate.slice(0, MONTH_KEY_LENGTH);

// Local time on purpose: "this month" is the user's calendar month, not UTC's.
export const toMonthKey = (date: Date): MonthKey =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

export const toIsoDate = (date: Date): string => `${toMonthKey(date)}-${pad2(date.getDate())}`;

// ISO dates parse as UTC midnight, so formatting in UTC keeps the calendar day from shifting
// with the viewer's time zone.
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

export const formatIsoDate = (isoDate: string): string => dateFormatter.format(new Date(isoDate));

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatMonth = (month: MonthKey): string =>
  monthFormatter.format(new Date(`${month}-01`));

// ---- Validation ----

export type ExpenseFormValues = Readonly<{
  title: string;
  amount: string;
  category: Category;
  date: string;
}>;

export type ExpenseFormField = 'title' | 'amount' | 'date';
export type ExpenseFormErrors = Readonly<Partial<Record<ExpenseFormField, string>>>;

export type ExpenseValidation =
  { status: 'valid'; draft: ExpenseDraft } | { status: 'invalid'; errors: ExpenseFormErrors };

export function validateExpense(values: ExpenseFormValues): ExpenseValidation {
  const title = values.title.trim();
  const amount = parseAmountToCents(values.amount);
  const errors: Partial<Record<ExpenseFormField, string>> = {};
  if (title === '') {
    errors.title = 'Enter a title.';
  }
  if (amount.status === 'invalid') {
    errors.amount = amount.error;
  }
  if (!isIsoDate(values.date)) {
    errors.date = 'Enter a valid date.';
  }
  if (amount.status === 'valid' && Object.keys(errors).length === 0) {
    return {
      status: 'valid',
      draft: { title, amountCents: amount.cents, category: values.category, date: values.date },
    };
  }
  return { status: 'invalid', errors };
}

// ---- Selectors (pure; totals are always derived from the expense list, never stored) ----

export type CategoryTotal = Readonly<{ category: Category; totalCents: number }>;
export type MonthTotals = Readonly<{
  totalCents: number;
  byCategory: readonly CategoryTotal[];
}>;

const sumCents = (expenses: readonly Expense[]): number =>
  expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

// Every category is listed, including empty ones, so the breakdown layout never jumps.
export function selectMonthTotals(expenses: readonly Expense[], month: MonthKey): MonthTotals {
  const inMonth = expenses.filter((expense) => monthOf(expense.date) === month);
  return {
    totalCents: sumCents(inMonth),
    byCategory: CATEGORIES.map((category) => ({
      category,
      totalCents: sumCents(inMonth.filter((expense) => expense.category === category)),
    })),
  };
}

export type ExpenseFilters = Readonly<{ month: MonthKey; category: CategoryFilter }>;

// Newest first; ties keep insertion order because toSorted is stable.
export function selectVisibleExpenses(
  expenses: readonly Expense[],
  { month, category }: ExpenseFilters,
): readonly Expense[] {
  return expenses
    .filter(
      (expense) =>
        monthOf(expense.date) === month &&
        (category === ALL_CATEGORIES || expense.category === category),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
}
