import { type JSX, type RefObject, useId } from 'react';
import { type Expense, formatIsoDate } from './expenses';
import { formatCents } from './money';
import './ExpenseList.css';

export type ExpenseListProps = Readonly<{
  expenses: readonly Expense[];
  editingId: string | null;
  /** Lets the page return focus here after a row's buttons disappear (delete, save, cancel). */
  headingRef: RefObject<HTMLHeadingElement | null>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}>;

export function ExpenseList({
  expenses,
  editingId,
  headingRef,
  onEdit,
  onDelete,
}: ExpenseListProps): JSX.Element {
  const headingId = useId();
  return (
    <section className="expense-list" aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="expense-list__heading">
        Expenses
      </h2>
      {expenses.length === 0 ? (
        <p className="expense-list__empty">No expenses match the current filters.</p>
      ) : (
        <ul className="expense-list__items" aria-labelledby={headingId}>
          {expenses.map((expense) => {
            const isEditing = expense.id === editingId;
            return (
              <li
                key={expense.id}
                className={
                  isEditing
                    ? 'expense-list__item expense-list__item--editing'
                    : 'expense-list__item'
                }
              >
                <div className="expense-list__details">
                  <span className="expense-list__title">{expense.title}</span>
                  <span className="expense-list__meta">
                    <time dateTime={expense.date}>{formatIsoDate(expense.date)}</time> ·{' '}
                    {expense.category}
                    {isEditing && <strong className="expense-list__badge">Editing</strong>}
                  </span>
                </div>
                <span className="expense-list__amount">{formatCents(expense.amountCents)}</span>
                <div className="expense-list__actions">
                  <button
                    type="button"
                    className="expense-list__button"
                    onClick={() => {
                      onEdit(expense.id);
                    }}
                  >
                    Edit<span className="visually-hidden"> {expense.title}</span>
                  </button>
                  <button
                    type="button"
                    className="expense-list__button expense-list__button--danger"
                    onClick={() => {
                      onDelete(expense.id);
                    }}
                  >
                    Delete<span className="visually-hidden"> {expense.title}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
