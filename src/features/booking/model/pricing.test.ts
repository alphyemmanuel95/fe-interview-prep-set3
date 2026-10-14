import { describe, expect, it } from 'vitest';
import { formatPrice, getPriceBreakdown } from './pricing';

describe('getPriceBreakdown', () => {
  it('prices VIP rows at 500 and other rows at 250', () => {
    expect(getPriceBreakdown(['A1', 'B3', 'C1'])).toEqual({
      lines: [
        { tier: 'vip', seatCount: 2, unitPriceCents: 50_000, subtotalCents: 100_000 },
        { tier: 'standard', seatCount: 1, unitPriceCents: 25_000, subtotalCents: 25_000 },
      ],
      totalCents: 125_000,
    });
  });

  it('is empty with no seats', () => {
    expect(getPriceBreakdown([])).toEqual({ lines: [], totalCents: 0 });
  });
});

describe('formatPrice', () => {
  it('always shows 2 decimal places', () => {
    expect(formatPrice(125_000)).toBe('₹1,250.00');
  });
});
