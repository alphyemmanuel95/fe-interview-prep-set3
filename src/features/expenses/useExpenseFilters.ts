import { useSearchParams } from 'react-router';
import {
  ALL_CATEGORIES,
  type ExpenseFilters,
  isCategoryFilter,
  isMonthKey,
  toMonthKey,
} from './expenses';

export type UseExpenseFiltersResult = Readonly<{
  filters: ExpenseFilters;
  setMonth: (value: string) => void;
  setCategory: (value: string) => void;
}>;

const MONTH_PARAM = 'month';
const CATEGORY_PARAM = 'category';

// Filters live in the URL (?month=YYYY-MM&category=Food) rather than localStorage: they survive
// a refresh, can be shared as a link, and two tabs can show different months independently.
export function useExpenseFilters(): UseExpenseFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get(MONTH_PARAM);
  const categoryParam = searchParams.get(CATEGORY_PARAM);

  // The URL is user-editable, so missing or invalid values fall back to the defaults.
  const filters: ExpenseFilters = {
    month: isMonthKey(monthParam) ? monthParam : toMonthKey(new Date()),
    category: isCategoryFilter(categoryParam) ? categoryParam : ALL_CATEGORIES,
  };

  function setParam(name: string, value: string): void {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(name, value);
        return next;
      },
      // Replace rather than push: one history entry per filter tweak would make Back step
      // through every change instead of leaving the page.
      { replace: true },
    );
  }

  return {
    filters,
    // Inputs hand back raw strings; anything that isn't a valid filter value is ignored.
    setMonth: (value) => {
      if (isMonthKey(value)) {
        setParam(MONTH_PARAM, value);
      }
    },
    setCategory: (value) => {
      if (isCategoryFilter(value)) {
        setParam(CATEGORY_PARAM, value);
      }
    },
  };
}
