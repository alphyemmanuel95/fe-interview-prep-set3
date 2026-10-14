import type { JSX } from 'react';
import { SEAT_TIERS } from '../model/catalog';
import type { SeatId } from '../model/catalog';
import { formatPrice, getPriceBreakdown } from '../model/pricing';
import './PriceBreakdownTable.css';

type PriceBreakdownTableProps = Readonly<{ seatIds: readonly SeatId[] }>;

export function PriceBreakdownTable({ seatIds }: PriceBreakdownTableProps): JSX.Element {
  const { lines, totalCents } = getPriceBreakdown(seatIds);

  return (
    <table className="price-table">
      <caption className="visually-hidden">Price breakdown</caption>
      <thead>
        <tr>
          <th scope="col">Seat type</th>
          <th scope="col" className="price-table__number">
            Qty
          </th>
          <th scope="col" className="price-table__number">
            Each
          </th>
          <th scope="col" className="price-table__number">
            Subtotal
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.tier}>
            <th scope="row">{SEAT_TIERS[line.tier].label}</th>
            <td className="price-table__number">{line.seatCount}</td>
            <td className="price-table__number">{formatPrice(line.unitPriceCents)}</td>
            <td className="price-table__number">{formatPrice(line.subtotalCents)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="price-table__total">
          <th scope="row" colSpan={3}>
            Total
          </th>
          <td className="price-table__number">{formatPrice(totalCents)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
