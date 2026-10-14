import type { BookingField } from '../model/types';

export function getFieldId(field: BookingField): string {
  return `booking-${field}`;
}

export function getErrorId(field: BookingField): string {
  return `booking-${field}-error`;
}

export type ControlProps = Readonly<{
  id: string;
  className: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}>;

/** Wires a control to its label and (only when present) its error message. */
export function getControlProps(field: BookingField, error: string | undefined): ControlProps {
  const hasError = error !== undefined;
  return {
    id: getFieldId(field),
    className: hasError
      ? 'form-field__control form-field__control--invalid'
      : 'form-field__control',
    'aria-invalid': hasError,
    'aria-describedby': hasError ? getErrorId(field) : undefined,
  };
}
