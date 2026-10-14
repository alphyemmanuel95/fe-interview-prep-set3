import { type JSX, type RefObject, useId } from 'react';
import {
  ALL_CATEGORIES,
  type Expense,
  type ExpenseFilters,
  formatIsoDate,
  formatMonth,
} from '../model/expenses';
import { formatCents } from '../model/money';
import './ExpenseList.css';

export type ExpenseListProps = Readonly<{
  expenses: readonly Expense[];
  editingId: string | null;
  /** Lets the page return focus here after a row's buttons disappear (delete, save, cancel). */
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Edit buttons by expense id, so focus can go back to a row after its edit finishes. */
  editButtonsRef: RefObject<Map<string, HTMLButtonElement>>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Whether any expense exists at all, to tell "nothing yet" apart from "filtered out". */
  hasAnyExpenses: boolean;
  filters: ExpenseFilters;
  onShowAllCategories: () => void;
}>;

type EmptyStateProps = Readonly<
  Pick<ExpenseListProps, 'hasAnyExpenses' | 'filters' | 'onShowAllCategories'>
>;

function EmptyState({
  hasAnyExpenses,
  filters: { month, category },
  onShowAllCategories,
}: EmptyStateProps): JSX.Element {
  if (!hasAnyExpenses) {
    return <p className="expense-list__empty">No expenses yet — add one above.</p>;
  }
  if (category === ALL_CATEGORIES) {
    return <p className="expense-list__empty">No expenses in {formatMonth(month)}.</p>;
  }
  return (
    <div className="expense-list__empty">
      <p className="expense-list__empty-text">
        No {category} expenses in {formatMonth(month)}.
      </p>
      <button type="button" className="expense-list__button" onClick={onShowAllCategories}>
        Show all categories
      </button>
    </div>
  );
}

export function ExpenseList({
  expenses,
  editingId,
  headingRef,
  editButtonsRef,
  onEdit,
  onDelete,
  hasAnyExpenses,
  filters,
  onShowAllCategories,
}: ExpenseListProps): JSX.Element {
  const headingId = useId();
  return (
    <section className="expense-list" aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="expense-list__heading">
        Expenses
      </h2>
      {expenses.length === 0 ? (
        <EmptyState
          hasAnyExpenses={hasAnyExpenses}
          filters={filters}
          onShowAllCategories={onShowAllCategories}
        />
      ) : (
        <ul className="expense-list__items">
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
                    aria-label={`Edit ${expense.title}`}
                    ref={(node) => {
                      // React 19 passes the node on mount and runs the returned cleanup on
                      // unmount, so null never arrives here in practice; the check satisfies the type.
                      if (node !== null) {
                        editButtonsRef.current.set(expense.id, node);
                      }
                      return () => {
                        editButtonsRef.current.delete(expense.id);
                      };
                    }}
                    onClick={() => {
                      onEdit(expense.id);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="expense-list__button expense-list__button--danger"
                    aria-label={`Delete ${expense.title}`}
                    onClick={() => {
                      onDelete(expense.id);
                    }}
                  >
                    Delete
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
