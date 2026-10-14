import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import { submitBooking } from '../api/submitBooking';
import type { BookingAction } from '../model/bookingReducer';
import type { BookingRequest } from '../model/types';

const SUBMIT_ERROR_MESSAGE = 'We couldn’t confirm your booking. Please try again.';

export function useBookingSubmission(
  dispatch: Dispatch<BookingAction>,
): (request: BookingRequest) => void {
  // The in-flight guard is a ref, not state: it applies synchronously, so a double click that
  // lands before React re-renders the disabled button still can't submit twice.
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Leaving the page cancels the request, so it can never resolve into an unmounted component.
      controllerRef.current?.abort();
    };
  }, []);

  return function submit(request: BookingRequest): void {
    if (controllerRef.current !== null) {
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: 'submitStarted' });

    void submitBooking(request, controller.signal)
      .then(
        (confirmation) => {
          dispatch({ type: 'submitSucceeded', confirmation });
        },
        () => {
          if (!controller.signal.aborted) {
            dispatch({ type: 'submitFailed', error: SUBMIT_ERROR_MESSAGE });
          }
        },
      )
      .finally(() => {
        controllerRef.current = null;
      });
  };
}
