import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ExpenseDraft } from '../model/expenses';
import { EXPENSES_STORAGE_KEY, EXPENSES_STORAGE_VERSION, useExpenses } from './useExpenses';

const LUNCH: ExpenseDraft = {
  title: 'Lunch',
  amountCents: 10,
  category: 'Food',
  date: '2026-10-03',
};

describe('useExpenses', () => {
  it('leaves stored data untouched when it fails to load', () => {
    const unreadable = JSON.stringify({
      version: EXPENSES_STORAGE_VERSION + 1,
      data: [{ ...LUNCH, id: 'a' }],
    });
    localStorage.setItem(EXPENSES_STORAGE_KEY, unreadable);

    const { result } = renderHook(() => useExpenses());

    expect(result.current.expenses).toEqual([]);
    expect(localStorage.getItem(EXPENSES_STORAGE_KEY)).toBe(unreadable);
  });

  it('restores persisted changes on the next mount', () => {
    const first = renderHook(() => useExpenses());
    act(() => {
      first.result.current.addExpense(LUNCH);
    });
    first.unmount();

    const { result } = renderHook(() => useExpenses());
    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.expenses[0]).toMatchObject(LUNCH);
  });
});
