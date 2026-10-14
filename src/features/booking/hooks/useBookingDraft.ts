import { useReducer } from 'react';
import type { Dispatch } from 'react';
import { bookingReducer, createBookingState, EMPTY_DRAFT } from '../model/bookingReducer';
import type { BookingAction, BookingState } from '../model/bookingReducer';

export function useBookingDraft(): readonly [BookingState, Dispatch<BookingAction>] {
  return useReducer(bookingReducer, EMPTY_DRAFT, createBookingState);
}
