import { getSeatTier, SEAT_TIER_ORDER, SEAT_TIERS } from './catalog';
import type { SeatId, SeatTier } from './catalog';

/** Minor units (paise for INR) per major unit (rupee). */
const CENTS_PER_UNIT = 100;
const priceFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export type PriceLine = Readonly<{
  tier: SeatTier;
  seatCount: number;
  unitPriceCents: number;
  subtotalCents: number;
}>;

export type PriceBreakdown = Readonly<{ lines: readonly PriceLine[]; totalCents: number }>;

// Always derived from the selected seats and never stored, so the price can't drift
// out of sync with the seat selection.
export function getPriceBreakdown(seatIds: readonly SeatId[]): PriceBreakdown {
  const lines = SEAT_TIER_ORDER.map((tier): PriceLine => {
    const seatCount = seatIds.filter((seatId) => getSeatTier(seatId) === tier).length;
    const unitPriceCents = SEAT_TIERS[tier].priceCents;
    return { tier, seatCount, unitPriceCents, subtotalCents: seatCount * unitPriceCents };
  }).filter((line) => line.seatCount > 0);
  const totalCents = lines.reduce((total, line) => total + line.subtotalCents, 0);
  return { lines, totalCents };
}

export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / CENTS_PER_UNIT);
}
