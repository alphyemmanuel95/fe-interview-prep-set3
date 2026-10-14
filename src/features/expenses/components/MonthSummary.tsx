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
      <p className="month-summary__scope">All categories, whatever the list is filtered to</p>
      {/* A polite, atomic live region: after an add, edit or delete screen readers hear the
          label with the new value ("Month total 132.79"), not a bare number. */}
      <output
        className="month-summary__total"
        aria-labelledby={totalLabelId}
        aria-live="polite"
        aria-atomic="true"
      >
        <span id={totalLabelId} className="month-summary__total-label">
          Month total
        </span>{' '}
        <span className="month-summary__total-value">{formatCents(totals.totalCents)}</span>
      </output>
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
