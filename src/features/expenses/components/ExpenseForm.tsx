import { type JSX, type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import {
  CATEGORIES,
  type Expense,
  type ExpenseDraft,
  type ExpenseFormErrors,
  type ExpenseFormField,
  type ExpenseFormValues,
  isCategory,
  toIsoDate,
  validateExpense,
} from '../model/expenses';
import { centsToAmountInput } from '../model/money';
import { FormField } from './FormField';
import './ExpenseForm.css';

export type ExpenseFormProps = Readonly<{
  /** The expense being edited, or `null` to add a new one. */
  expense: Expense | null;
  onSave: (draft: ExpenseDraft) => void;
  onCancel: () => void;
}>;

const FIELD_ORDER: readonly ExpenseFormField[] = ['title', 'amount', 'date'];
const NO_ERRORS: ExpenseFormErrors = {};

function toFormValues(expense: Expense | null): ExpenseFormValues {
  if (expense === null) {
    return { title: '', amount: '', category: CATEGORIES[0], date: toIsoDate(new Date()) };
  }
  return {
    title: expense.title,
    amount: centsToAmountInput(expense.amountCents),
    category: expense.category,
    date: expense.date,
  };
}

// Add and Edit share this form. The parent keys it by expense id, so switching between them
// remounts it with fresh values instead of syncing props into state with an effect.
export function ExpenseForm({ expense, onSave, onCancel }: ExpenseFormProps): JSX.Element {
  const id = useId();
  const isEditing = expense !== null;
  const [values, setValues] = useState(() => toFormValues(expense));
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // Errors are derived from the current values, so each one clears as soon as its field is fixed.
  // They stay hidden until the first submit so the user isn't told off while still typing.
  const validation = validateExpense(values);
  const errors =
    hasAttemptedSubmit && validation.status === 'invalid' ? validation.errors : NO_ERRORS;

  useEffect(() => {
    if (isEditing) {
      titleRef.current?.focus();
    }
  }, [isEditing]);

  function updateValue<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (validation.status === 'invalid') {
      setHasAttemptedSubmit(true);
      const fieldRefs = { title: titleRef, amount: amountRef, date: dateRef };
      const firstInvalid = FIELD_ORDER.find((field) => validation.errors[field] !== undefined);
      if (firstInvalid !== undefined) {
        fieldRefs[firstInvalid].current?.focus();
      }
      return;
    }
    onSave(validation.draft);
    if (!isEditing) {
      // Keep category and date: consecutive entries usually share them.
      setValues((current) => ({ ...current, title: '', amount: '' }));
      setHasAttemptedSubmit(false);
      titleRef.current?.focus();
    }
  }

  const fieldId = (field: keyof ExpenseFormValues): string => `${id}-${field}`;

  return (
    <form
      className="expense-form"
      aria-labelledby={`${id}-heading`}
      noValidate
      onSubmit={handleSubmit}
    >
      <h2 id={`${id}-heading`} className="expense-form__heading">
        {isEditing ? 'Edit expense' : 'Add expense'}
      </h2>

      <FormField id={fieldId('title')} label="Title" error={errors.title}>
        {(controlProps) => (
          <input
            {...controlProps}
            ref={titleRef}
            className="form-field__control"
            type="text"
            autoComplete="off"
            value={values.title}
            onChange={(event) => {
              updateValue('title', event.target.value);
            }}
          />
        )}
      </FormField>

      <FormField id={fieldId('amount')} label="Amount" error={errors.amount}>
        {(controlProps) => (
          <input
            {...controlProps}
            ref={amountRef}
            className="form-field__control"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) => {
              updateValue('amount', event.target.value);
            }}
          />
        )}
      </FormField>

      <FormField id={fieldId('category')} label="Category" error={undefined}>
        {(controlProps) => (
          <select
            {...controlProps}
            className="form-field__control"
            value={values.category}
            onChange={(event) => {
              const { value } = event.target;
              if (isCategory(value)) {
                updateValue('category', value);
              }
            }}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField id={fieldId('date')} label="Date" error={errors.date}>
        {(controlProps) => (
          <input
            {...controlProps}
            ref={dateRef}
            className="form-field__control"
            type="date"
            value={values.date}
            onChange={(event) => {
              updateValue('date', event.target.value);
            }}
          />
        )}
      </FormField>

      <div className="expense-form__actions">
        <button type="submit" className="expense-form__button expense-form__button--primary">
          {isEditing ? 'Save changes' : 'Add expense'}
        </button>
        {isEditing && (
          <button type="button" className="expense-form__button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
