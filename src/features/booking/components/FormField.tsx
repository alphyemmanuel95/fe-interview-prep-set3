import type { JSX, ReactNode } from 'react';
import type { BookingField } from '../model/types';
import { FieldErrorMessage } from './FieldErrorMessage';
import { getFieldId } from './fieldIds';
import './FormField.css';

type FormFieldProps = Readonly<{
  field: BookingField;
  label: ReactNode;
  error: string | undefined;
  /** The control, spread with `getControlProps(field, error)` so its id and ARIA match. */
  children: ReactNode;
}>;

export function FormField({ field, label, error, children }: FormFieldProps): JSX.Element {
  return (
    <div className="form-field">
      <label htmlFor={getFieldId(field)} className="form-field__label">
        {label}
      </label>
      {children}
      <FieldErrorMessage field={field} message={error} />
    </div>
  );
}
