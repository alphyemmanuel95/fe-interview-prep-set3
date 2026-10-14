// Money is held as integer cents everywhere. Floats only appear at the very edge (formatting),
// so sums are exact: 10 + 20 cents is 30 cents, never 0.30000000000000004.

const CENTS_PER_UNIT = 100;
const FRACTION_DIGITS = 2;
// Digits, optionally followed by a dot and one or two decimals. No sign, so negatives are rejected.
const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export type AmountParseResult =
  { status: 'valid'; cents: number } | { status: 'invalid'; error: string };

// Parses user input with string and integer maths only ("0.1" -> 10), so no float rounding is involved.
export function parseAmountToCents(input: string): AmountParseResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { status: 'invalid', error: 'Enter an amount.' };
  }
  const match = AMOUNT_PATTERN.exec(trimmed);
  if (match === null) {
    return { status: 'invalid', error: 'Enter a positive number with up to 2 decimals.' };
  }
  const [, whole = '', fraction = ''] = match;
  const cents = Number(whole) * CENTS_PER_UNIT + Number(fraction.padEnd(FRACTION_DIGITS, '0'));
  if (cents === 0) {
    return { status: 'invalid', error: 'Amount must be greater than zero.' };
  }
  if (!Number.isSafeInteger(cents)) {
    return { status: 'invalid', error: 'Amount is too large.' };
  }
  return { status: 'valid', cents };
}

// Inverse of parseAmountToCents, used to prefill the form when editing (1250 -> "12.50").
export function centsToAmountInput(cents: number): string {
  const whole = Math.trunc(cents / CENTS_PER_UNIT);
  const fraction = String(cents % CENTS_PER_UNIT).padStart(FRACTION_DIGITS, '0');
  return `${whole}.${fraction}`;
}

// A fixed locale keeps output (and tests) identical on every machine.
const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: FRACTION_DIGITS,
  maximumFractionDigits: FRACTION_DIGITS,
});

export function formatCents(cents: number): string {
  return amountFormatter.format(cents / CENTS_PER_UNIT);
}
