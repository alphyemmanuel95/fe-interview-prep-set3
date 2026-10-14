import type { JSX, ReactNode } from 'react';
import './FormField.css';

export type FormControlProps = Readonly<{
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
}>;

export type FormFieldProps = Readonly<{
  id: string;
  label: string;
  error: string | undefined;
  /** Receives the props that tie the control to its label and error message. */
  children: (controlProps: FormControlProps) => ReactNode;
}>;

// Owns the label/error wiring so every control gets the same `aria-invalid` and
// `aria-describedby` handling; the render prop keeps the control itself (input, select, refs) free.
export function FormField({ id, label, error, children }: FormFieldProps): JSX.Element {
  const errorId = `${id}-error`;
  const controlProps: FormControlProps =
    error === undefined
      ? { id, 'aria-invalid': false }
      : { id, 'aria-invalid': true, 'aria-describedby': errorId };

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {children(controlProps)}
      {error !== undefined && (
        <p id={errorId} className="form-field__error">
          {error}
        </p>
      )}
    </div>
  );
}
