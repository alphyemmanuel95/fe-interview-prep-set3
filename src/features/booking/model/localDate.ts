// Dates are handled as local `YYYY-MM-DD` strings (the format of <input type="date">).
// Zero-padded ISO dates compare correctly as strings, so no Date maths is needed for validation.

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_LOCALE = 'en-IN';

const dateFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, { dateStyle: 'full' });

// Deliberately not `toISOString()`: that is UTC, so just after midnight in India it still
// reports yesterday, which would let a user book a past date (or reject today).
export function toLocalIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a local `YYYY-MM-DD` date, rejecting impossible dates such as `2026-02-31`. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);
  const isSameCalendarDay =
    date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day;
  return isSameCalendarDay ? date : null;
}

export function formatIsoDate(value: string): string {
  const date = parseIsoDate(value);
  return date === null ? value : dateFormatter.format(date);
}
