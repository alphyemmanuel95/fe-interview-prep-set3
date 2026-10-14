// Static catalogue for the booking flow. A real app would fetch this; keeping it `as const`
// gives literal types, so an unknown event or seat id is a compile error, not a runtime surprise.

export const EVENTS = [
  { id: 'jazz-night', name: 'Jazz Night' },
  { id: 'symphony-gala', name: 'Symphony Gala' },
  { id: 'comedy-special', name: 'Stand-up Comedy Special' },
] as const satisfies readonly Readonly<{ id: string; name: string }>[];

export type BookingEvent = (typeof EVENTS)[number];
export type EventId = BookingEvent['id'];

export const SEAT_ROWS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type SeatRow = (typeof SEAT_ROWS)[number];

export const SEAT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type SeatNumber = (typeof SEAT_NUMBERS)[number];

export type SeatId = `${SeatRow}${SeatNumber}`;
export type SeatTier = 'vip' | 'standard';

export const MAX_SEATS_PER_BOOKING = 6;

// Money is held in integer minor units so totals never accumulate floating-point error.
// "Cents" is the codebase-wide name for a minor unit (standards §4); for INR one cent is one paisa,
// so 50_000 cents is ₹500.00. Keeping one name means the maths reads the same for any currency.
export const SEAT_TIERS = {
  vip: { label: 'VIP', priceCents: 50_000 },
  standard: { label: 'Standard', priceCents: 25_000 },
} as const satisfies Record<SeatTier, Readonly<{ label: string; priceCents: number }>>;

export const SEAT_TIER_ORDER = ['vip', 'standard'] as const satisfies readonly SeatTier[];

const VIP_ROWS: readonly SeatRow[] = ['A', 'B'];

export function toSeatId(row: SeatRow, seatNumber: SeatNumber): SeatId {
  return `${row}${seatNumber}`;
}

// Layout order (A1…A8, B1…F8). Selections are kept in this order so attendee fields and the
// review list read front-to-back regardless of the order seats were clicked.
export const ALL_SEAT_IDS: readonly SeatId[] = SEAT_ROWS.flatMap((row) =>
  SEAT_NUMBERS.map((seatNumber) => toSeatId(row, seatNumber)),
);

const SEAT_ID_SET: ReadonlySet<string> = new Set(ALL_SEAT_IDS);

const VIP_SEAT_IDS: ReadonlySet<SeatId> = new Set(
  VIP_ROWS.flatMap((row) => SEAT_NUMBERS.map((seatNumber) => toSeatId(row, seatNumber))),
);

const BOOKED_SEAT_IDS: ReadonlySet<SeatId> = new Set<SeatId>([
  'A4',
  'A5',
  'B2',
  'C6',
  'C7',
  'D1',
  'E4',
  'E5',
  'F8',
]);

export function isSeatId(value: string): value is SeatId {
  return SEAT_ID_SET.has(value);
}

export function isSeatBooked(seatId: SeatId): boolean {
  return BOOKED_SEAT_IDS.has(seatId);
}

export function getSeatTier(seatId: SeatId): SeatTier {
  return VIP_SEAT_IDS.has(seatId) ? 'vip' : 'standard';
}

export function getSeatPriceCents(seatId: SeatId): number {
  return SEAT_TIERS[getSeatTier(seatId)].priceCents;
}

/** Returns the known seats among `seatIds`, de-duplicated and in layout order. */
export function sortSeatIds(seatIds: readonly string[]): readonly SeatId[] {
  return ALL_SEAT_IDS.filter((seatId) => seatIds.includes(seatId));
}

export function isEventId(value: string): value is EventId {
  return EVENTS.some((event) => event.id === value);
}

export function findEvent(eventId: EventId): BookingEvent | undefined {
  return EVENTS.find((event) => event.id === eventId);
}

const UNKNOWN_EVENT_NAME = 'Unknown event';

/** Display name with a visible fallback, so a missing event never renders as a blank value. */
export function getEventName(eventId: EventId | null): string {
  return (eventId === null ? undefined : findEvent(eventId)?.name) ?? UNKNOWN_EVENT_NAME;
}
