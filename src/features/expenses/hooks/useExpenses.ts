import { useEffect, useReducer, useRef } from 'react';
import { loadFromStorage, saveToStorage } from '../../../shared/storage';
import { type Expense, type ExpenseDraft, expensesReducer, isExpenseList } from '../model/expenses';

export type UseExpensesResult = Readonly<{
  expenses: readonly Expense[];
  addExpense: (draft: ExpenseDraft) => void;
  updateExpense: (id: string, draft: ExpenseDraft) => void;
  deleteExpense: (id: string) => void;
}>;

export const EXPENSES_STORAGE_KEY = 'expenses';
// Bump when the Expense shape changes; older data then falls back to an empty list.
export const EXPENSES_STORAGE_VERSION = 1;
const NO_EXPENSES: readonly Expense[] = [];

const loadExpenses = (): readonly Expense[] =>
  loadFromStorage(EXPENSES_STORAGE_KEY, EXPENSES_STORAGE_VERSION, isExpenseList, NO_EXPENSES);

export function useExpenses(): UseExpensesResult {
  // Lazy initialiser: storage is read once on mount, not on every render.
  const [expenses, dispatch] = useReducer(expensesReducer, undefined, loadExpenses);
  const loadedExpensesRef = useRef(expenses);

  // One effect persists every change, whichever action caused it. The list loaded on mount is
  // skipped: if stored data failed the guard we fell back to [], and writing that back would
  // erase the user's data before they had changed anything.
  useEffect(() => {
    if (expenses === loadedExpensesRef.current) {
      return;
    }
    saveToStorage(EXPENSES_STORAGE_KEY, EXPENSES_STORAGE_VERSION, expenses);
  }, [expenses]);

  return {
    expenses,
    // The id is generated here, not in the reducer, so the reducer stays pure (StrictMode replays it).
    addExpense: (draft) => {
      dispatch({ type: 'added', expense: { ...draft, id: crypto.randomUUID() } });
    },
    updateExpense: (id, draft) => {
      dispatch({ type: 'updated', id, draft });
    },
    deleteExpense: (id) => {
      dispatch({ type: 'deleted', id });
    },
  };
}
