import { useReducer } from 'react';
import { type Expense, type ExpenseDraft, expensesReducer } from './expenses';

export type UseExpensesResult = Readonly<{
  expenses: readonly Expense[];
  addExpense: (draft: ExpenseDraft) => void;
  updateExpense: (id: string, draft: ExpenseDraft) => void;
  deleteExpense: (id: string) => void;
}>;

const NO_EXPENSES: readonly Expense[] = [];

export function useExpenses(): UseExpensesResult {
  const [expenses, dispatch] = useReducer(expensesReducer, NO_EXPENSES);

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
