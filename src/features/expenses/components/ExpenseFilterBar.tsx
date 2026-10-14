import { type JSX, useId } from 'react';
import { ALL_CATEGORIES, CATEGORIES, type ExpenseFilters, shiftMonth } from '../model/expenses';
import { FormField } from './FormField';
import './ExpenseFilterBar.css';

export type ExpenseFilterBarProps = Readonly<{
  filters: ExpenseFilters;
  /** Receives the raw input value; the owner validates it. */
  onMonthChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}>;

export function ExpenseFilterBar({
  filters: { month, category },
  onMonthChange,
  onCategoryChange,
}: ExpenseFilterBarProps): JSX.Element {
  const id = useId();

  return (
    <fieldset className="expense-filter-bar">
      <legend className="expense-filter-bar__legend">Filters</legend>
      <FormField id={`${id}-month`} label="Month" error={undefined}>
        {(controlProps) => (
          // The buttons keep the month changeable where type="month" falls back to a plain text
          // box (Safari and Firefox desktop), in which partial typing is never a valid month.
          <div className="expense-filter-bar__month">
            <button
              type="button"
              className="expense-filter-bar__step"
              aria-label="Previous month"
              onClick={() => {
                onMonthChange(shiftMonth(month, -1));
              }}
            >
              ‹
            </button>
            <input
              {...controlProps}
              className="form-field__control"
              type="month"
              value={month}
              onChange={(event) => {
                onMonthChange(event.target.value);
              }}
            />
            <button
              type="button"
              className="expense-filter-bar__step"
              aria-label="Next month"
              onClick={() => {
                onMonthChange(shiftMonth(month, 1));
              }}
            >
              ›
            </button>
          </div>
        )}
      </FormField>
      <FormField id={`${id}-category`} label="Category" error={undefined}>
        {(controlProps) => (
          <select
            {...controlProps}
            className="form-field__control"
            value={category}
            onChange={(event) => {
              onCategoryChange(event.target.value);
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
  );
}
