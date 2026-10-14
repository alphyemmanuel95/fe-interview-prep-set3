import { type JSX, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ALL_CATEGORIES,
  type ExpenseDraft,
  defaultCategoryFor,
  defaultDateForMonth,
  selectMonthTotals,
  selectVisibleExpenses,
} from './model/expenses';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseFilterBar } from './components/ExpenseFilterBar';
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
  const editButtonsRef = useRef(new Map<string, HTMLButtonElement>());

  // Totals are derived from the expense list, never stored beside it: with a single source of
  // truth, an add, edit or delete cannot leave a stale total behind. Recomputing a few hundred
  // rows per render is cheap and no memoised child depends on these references, so no useMemo.
  const monthTotals = selectMonthTotals(expenses, month);
  const visibleExpenses = selectVisibleExpenses(expenses, { month, category });

  // Only the id is stored, so the form always edits the current version of the expense
  // and falls back to "add" by itself if that expense is deleted.
  const editingExpense = expenses.find((expense) => expense.id === editingId) ?? null;

  // flushSync commits the list first, so we can tell whether the row is still visible: a changed
  // date or category may have moved it out of the current filters, and then the heading is next.
  function stopEditing(id: string, applyChange?: () => void): void {
    flushSync(() => {
      applyChange?.();
      setEditingId(null);
    });
    (editButtonsRef.current.get(id) ?? listHeadingRef.current)?.focus();
  }

  function handleSave(draft: ExpenseDraft): void {
    if (editingExpense === null) {
      addExpense(draft);
      return;
    }
    const { id } = editingExpense;
    stopEditing(id, () => {
      updateExpense(id, draft);
    });
  }

  function handleCancel(): void {
    if (editingId !== null) {
      stopEditing(editingId);
    }
  }

  function handleShowAllCategories(): void {
    setCategory(ALL_CATEGORIES);
    // The button that had focus disappears once the list fills, so keep focus in the list.
    listHeadingRef.current?.focus();
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

      <ExpenseFilterBar filters={filters} onMonthChange={setMonth} onCategoryChange={setCategory} />

      <div className="expenses-page__grid">
        <ExpenseForm
          key={editingExpense?.id ?? 'new'}
          expense={editingExpense}
          onSave={handleSave}
          defaults={{
            category: defaultCategoryFor(category),
            date: defaultDateForMonth(month, new Date()),
          }}
          onCancel={handleCancel}
        />
        <MonthSummary month={month} totals={monthTotals} />
      </div>

      <ExpenseList
        expenses={visibleExpenses}
        editingId={editingId}
        headingRef={listHeadingRef}
        editButtonsRef={editButtonsRef}
        onEdit={setEditingId}
        onDelete={handleDelete}
        hasAnyExpenses={expenses.length > 0}
        filters={filters}
        onShowAllCategories={handleShowAllCategories}
      />
    </section>
  );
}
