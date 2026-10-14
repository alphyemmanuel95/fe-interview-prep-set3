import type { JSX } from 'react';
import { ExpenseForm } from './ExpenseForm';
import { useExpenses } from './useExpenses';
import './ExpensesPage.css';

export function ExpensesPage(): JSX.Element {
  const { addExpense } = useExpenses();

  return (
    <section className="expenses-page" aria-labelledby="expenses-title">
      <h1 id="expenses-title" className="expenses-page__title">
        Expense Tracker
      </h1>
      <ExpenseForm expense={null} onSave={addExpense} onCancel={() => undefined} />
    </section>
  );
}
