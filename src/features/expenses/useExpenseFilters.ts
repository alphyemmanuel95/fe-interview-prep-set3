import { useState } from 'react';
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

export function useExpenseFilters(): UseExpenseFiltersResult {
  const [filters, setFilters] = useState<ExpenseFilters>(() => ({
    month: toMonthKey(new Date()),
    category: ALL_CATEGORIES,
  }));

  return {
    filters,
    // Inputs hand back raw strings; anything that isn't a valid filter value is ignored.
    setMonth: (value) => {
      if (isMonthKey(value)) {
        setFilters((current) => ({ ...current, month: value }));
      }
    },
    setCategory: (value) => {
      if (isCategoryFilter(value)) {
        setFilters((current) => ({ ...current, category: value }));
      }
    },
  };
}
