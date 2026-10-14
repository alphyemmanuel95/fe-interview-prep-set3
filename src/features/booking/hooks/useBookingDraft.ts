import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import { loadFromStorage, saveToStorage } from '../../../shared/storage';
import { bookingReducer, createBookingState, EMPTY_DRAFT } from '../model/bookingReducer';
import type { BookingAction, BookingState } from '../model/bookingReducer';
import { isStoredDraft, restoreDraft } from '../model/draftPersistence';

const STORAGE_KEY = 'booking-draft';
const STORAGE_VERSION = 1;

function loadBookingState(today: string): BookingState {
  const stored = loadFromStorage(STORAGE_KEY, STORAGE_VERSION, isStoredDraft, EMPTY_DRAFT);
  return createBookingState(restoreDraft(stored, today));
}

/**
 * Booking state that survives a refresh. Only the draft is persisted: submit status is transient,
 * and a successful submit empties the draft, which clears what is stored.
 */
export function useBookingDraft(today: string): readonly [BookingState, Dispatch<BookingAction>] {
  const [state, dispatch] = useReducer(bookingReducer, today, loadBookingState);
  const { draft } = state;

  useEffect(() => {
    saveToStorage(STORAGE_KEY, STORAGE_VERSION, draft);
  }, [draft]);

  return [state, dispatch];
}
