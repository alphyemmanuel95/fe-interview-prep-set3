import type { JSX } from 'react';
import {
  getSeatPriceCents,
  getSeatTier,
  isSeatBooked,
  SEAT_NUMBERS,
  SEAT_ROWS,
  SEAT_TIERS,
  toSeatId,
} from '../model/catalog';
import type { SeatId, SeatNumber, SeatRow } from '../model/catalog';
import { formatPrice } from '../model/pricing';
import './SeatGrid.css';

type SeatGridProps = Readonly<{
  selectedSeatIds: readonly SeatId[];
  /** Once the limit is reached, unselected seats are disabled until one is deselected. */
  isAtLimit: boolean;
  onSeatToggle: (seatId: SeatId) => void;
}>;

type SeatStatus = 'available' | 'selected' | 'booked';

function getSeatStatus(seatId: SeatId, selectedSeatIds: readonly SeatId[]): SeatStatus {
  if (isSeatBooked(seatId)) {
    return 'booked';
  }
  return selectedSeatIds.includes(seatId) ? 'selected' : 'available';
}

// State lives in the accessible name and `aria-pressed`, not only in the colour.
function getSeatLabel(seatId: SeatId, status: SeatStatus): string {
  const tierLabel = SEAT_TIERS[getSeatTier(seatId)].label;
  const label = `Seat ${seatId}, ${tierLabel}, ${formatPrice(getSeatPriceCents(seatId))}`;
  return status === 'booked' ? `${label}, already booked` : label;
}

function getRowLabel(row: SeatRow): string {
  return `Row ${row}, ${SEAT_TIERS[getSeatTier(toSeatId(row, 1))].label}`;
}

export function SeatGrid({ selectedSeatIds, isAtLimit, onSeatToggle }: SeatGridProps): JSX.Element {
  function renderSeat(row: SeatRow, seatNumber: SeatNumber): JSX.Element {
    const seatId = toSeatId(row, seatNumber);
    const status = getSeatStatus(seatId, selectedSeatIds);
    return (
      <button
        key={seatId}
        type="button"
        className={`seat-grid__seat seat-grid__seat--${status} seat-grid__seat--${getSeatTier(seatId)}`}
        aria-label={getSeatLabel(seatId, status)}
        aria-pressed={status === 'selected'}
        disabled={status === 'booked' || (status === 'available' && isAtLimit)}
        onClick={() => {
          onSeatToggle(seatId);
        }}
      >
        {seatNumber}
      </button>
    );
  }

  return (
    <div className="seat-grid">
      <ul className="seat-grid__legend" aria-label="Seat key">
        <li className="seat-grid__legend-item">
          <span className="seat-grid__seat seat-grid__seat--available" aria-hidden="true" />
          Available
        </li>
        <li className="seat-grid__legend-item">
          <span className="seat-grid__seat seat-grid__seat--selected" aria-hidden="true" />
          Selected
        </li>
        <li className="seat-grid__legend-item">
          <span className="seat-grid__seat seat-grid__seat--booked" aria-hidden="true" />
          Booked
        </li>
        <li className="seat-grid__legend-item">
          <span className="seat-grid__seat seat-grid__seat--vip" aria-hidden="true" />
          VIP rows A–B, {formatPrice(SEAT_TIERS.vip.priceCents)}
        </li>
        <li className="seat-grid__legend-item">
          <span className="seat-grid__seat seat-grid__seat--standard" aria-hidden="true" />
          Rows C–F, {formatPrice(SEAT_TIERS.standard.priceCents)}
        </li>
      </ul>
      <p className="seat-grid__stage" aria-hidden="true">
        Stage
      </p>
      <div className="seat-grid__rows">
        {SEAT_ROWS.map((row) => (
          <div key={row} className="seat-grid__row" role="group" aria-label={getRowLabel(row)}>
            <span className="seat-grid__row-label" aria-hidden="true">
              {row}
            </span>
            {SEAT_NUMBERS.map((seatNumber) => renderSeat(row, seatNumber))}
          </div>
        ))}
      </div>
    </div>
  );
}
