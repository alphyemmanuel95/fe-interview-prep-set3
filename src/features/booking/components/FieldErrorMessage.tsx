import type { JSX } from 'react';
import type { BookingField } from '../model/types';
import { getErrorId } from './fieldIds';
import './FieldErrorMessage.css';

type FieldErrorMessageProps = Readonly<{ field: BookingField; message: string | undefined }>;

export function FieldErrorMessage({ field, message }: FieldErrorMessageProps): JSX.Element | null {
  if (message === undefined) {
    return null;
  }
  return (
    <p id={getErrorId(field)} className="field-error">
      {/* The space sits outside the span: whitespace inside a visually hidden span can be
          dropped from the accessible name, which would read "Error:Choose…". */}
      <span className="visually-hidden">Error:</span> {message}
    </p>
  );
}
