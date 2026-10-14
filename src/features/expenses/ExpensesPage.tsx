import { type JSX, useRef, useState } from 'react';
import type { ExpenseDraft } from './expenses';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseList } from './ExpenseList';
import { useExpenses } from './useExpenses';
import './ExpensesPage.css';

export function ExpensesPage(): JSX.Element {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [editingId, setEditingId] = useState<string | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);

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
      <ExpenseForm
        key={editingExpense?.id ?? 'new'}
        expense={editingExpense}
        onSave={handleSave}
        onCancel={stopEditing}
      />
      <ExpenseList
        expenses={expenses}
        editingId={editingId}
        headingRef={listHeadingRef}
        onEdit={setEditingId}
        onDelete={handleDelete}
      />
    </section>
  );
}
