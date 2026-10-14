import { describe, expect, it } from 'vitest';
import { centsToAmountInput, formatCents, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.1', 10],
    ['0.01', 1],
    ['  7.25  ', 725],
  ])('parses %j as %i cents', (input, cents) => {
    expect(parseAmountToCents(input)).toEqual({ status: 'valid', cents });
  });

  it.each([
    ['', 'Enter an amount.'],
    ['   ', 'Enter an amount.'],
    ['0', 'Amount must be greater than zero.'],
    ['0.00', 'Amount must be greater than zero.'],
    ['-5', 'Enter an amount like 12.50.'],
    ['abc', 'Enter an amount like 12.50.'],
    ['1.234', 'Enter an amount like 12.50.'],
    ['1e3', 'Enter an amount like 12.50.'],
    ['1,000', 'Enter an amount like 12.50.'],
    ['.5', 'Enter an amount like 12.50.'],
    ['5.', 'Enter an amount like 12.50.'],
    ['99999999999999999', 'Amount is too large.'],
  ])('rejects %j', (input, error) => {
    expect(parseAmountToCents(input)).toEqual({ status: 'invalid', error });
  });
});

describe('formatCents', () => {
  it('shows 0.10 + 0.20 as 0.30', () => {
    expect(formatCents(10 + 20)).toBe('0.30');
  });

  it('always shows two decimals and groups thousands', () => {
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(500)).toBe('5.00');
    expect(formatCents(123456)).toBe('1,234.56');
  });
});

describe('centsToAmountInput', () => {
  it('round-trips through the parser', () => {
    for (const cents of [1, 10, 99, 100, 1250, 123456]) {
      expect(parseAmountToCents(centsToAmountInput(cents))).toEqual({ status: 'valid', cents });
    }
  });
});
