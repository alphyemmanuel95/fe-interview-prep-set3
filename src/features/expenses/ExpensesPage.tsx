import { type JSX, useId, useRef, useState } from 'react';
import {
  ALL_CATEGORIES,
  CATEGORIES,
  type ExpenseDraft,
  selectMonthTotals,
  selectVisibleExpenses,
} from './model/expenses';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { FormField } from './components/FormField';
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
  // truth, an add, edit or delete cannot leave a stale total behind. Recomputing a few hundred
  // rows per render is cheap and no memoised child depends on these references, so no useMemo.
  const monthTotals = selectMonthTotals(expenses, month);
  const visibleExpenses = selectVisibleExpenses(expenses, { month, category });

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
        <FormField id={`${filterId}-month`} label="Month" error={undefined}>
          {(controlProps) => (
            <input
              {...controlProps}
              className="form-field__control"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
              }}
            />
          )}
        </FormField>
        <FormField id={`${filterId}-category`} label="Category" error={undefined}>
          {(controlProps) => (
            <select
              {...controlProps}
              className="form-field__control"
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
          )}
        </FormField>
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
