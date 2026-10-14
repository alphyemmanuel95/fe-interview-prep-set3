import { type JSX, useId } from 'react';
import { formatMonth, type MonthKey, type MonthTotals } from '../model/expenses';
import { formatCents } from '../model/money';
import './MonthSummary.css';

export type MonthSummaryProps = Readonly<{
  month: MonthKey;
  totals: MonthTotals;
}>;

// Always summarises the whole month, ignoring the category filter, so the breakdown stays
// comparable across categories while the list is narrowed down.
export function MonthSummary({ month, totals }: MonthSummaryProps): JSX.Element {
  const headingId = useId();
  const totalLabelId = useId();
  const monthLabel = formatMonth(month);

  return (
    <section className="month-summary" aria-labelledby={headingId}>
      <h2 id={headingId} className="month-summary__heading">
        {monthLabel}
      </h2>
      <p className="month-summary__total">
        <span id={totalLabelId} className="month-summary__total-label">
          Month total
        </span>
        {/* A polite live region, so screen readers hear the new total after an add, edit or delete. */}
        <output
          aria-labelledby={totalLabelId}
          aria-live="polite"
          className="month-summary__total-value"
        >
          {formatCents(totals.totalCents)}
        </output>
      </p>
      <table className="month-summary__table">
        <caption className="month-summary__caption">By category</caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {totals.byCategory.map(({ category, totalCents }) => (
            <tr key={category} className="month-summary__row">
              <th scope="row" className="month-summary__category">
                {category}
              </th>
              <td className="month-summary__amount">{formatCents(totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
