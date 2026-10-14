import { type JSX, useId, useMemo, useRef, useState } from 'react';
import {
  ALL_CATEGORIES,
  CATEGORIES,
  type ExpenseDraft,
  selectMonthTotals,
  selectVisibleExpenses,
} from './model/expenses';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { MonthSummary } from './components/MonthSummary';
import { useExpenseFilters } from './hooks/useExpenseFilters';
import { useExpenses } from './hooks/useExpenses';
import './ExpensesPage.css';

export function ExpensesPage(): JSX.Element {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses();
  const { filters, setMonth, setCategory } = useExpenseFilters();
  const { month, category } = filters;
  const [editingId, setEditingId] = useState<string | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const filterId = useId();

  // Totals are derived from the expense list, never stored beside it: with a single source of
  // truth, an add, edit or delete cannot leave a stale total behind. useMemo only skips the
  // recomputation on renders that change neither input, such as starting an edit.
  const monthTotals = useMemo(() => selectMonthTotals(expenses, month), [expenses, month]);
  const visibleExpenses = useMemo(
    () => selectVisibleExpenses(expenses, { month, category }),
    [expenses, month, category],
  );

  // Only the id is stored, so the form always edits the current version of the expense
  // and falls back to "add" by itself if that expense is deleted.
  const editingExpense = expenses.find((expense) => expense.id === editingId) ?? null;

  function stopEditing(): void {
    setEditingId(null);
    listHeadingRef.current?.focus();
  }

  function handleSave(draft: ExpenseDraft): void {
    if (editingExpense === null) {
      addExpense(draft);
      return;
    }
    updateExpense(editingExpense.id, draft);
    stopEditing();
  }

  function handleDelete(id: string): void {
    deleteExpense(id);
    if (id === editingId) {
      setEditingId(null);
    }
    listHeadingRef.current?.focus();
  }

  return (
    <section className="expenses-page" aria-labelledby="expenses-title">
      <h1 id="expenses-title" className="expenses-page__title">
        Expense Tracker
      </h1>

      <fieldset className="expenses-page__filters">
        <legend className="expenses-page__legend">Filters</legend>
        <div className="expenses-page__filter">
          <label htmlFor={`${filterId}-month`}>Month</label>
          <input
            id={`${filterId}-month`}
            className="expenses-page__control"
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
            }}
          />
        </div>
        <div className="expenses-page__filter">
          <label htmlFor={`${filterId}-category`}>Category</label>
          <select
            id={`${filterId}-category`}
            className="expenses-page__control"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          >
            <option value={ALL_CATEGORIES}>All categories</option>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="expenses-page__grid">
        <ExpenseForm
          key={editingExpense?.id ?? 'new'}
          expense={editingExpense}
          onSave={handleSave}
          onCancel={stopEditing}
        />
        <MonthSummary month={month} totals={monthTotals} />
      </div>

      <ExpenseList
        expenses={visibleExpenses}
        editingId={editingId}
        headingRef={listHeadingRef}
        onEdit={setEditingId}
        onDelete={handleDelete}
      />
    </section>
  );
}
