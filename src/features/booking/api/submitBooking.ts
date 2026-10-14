import type { BookingConfirmation, BookingRequest } from '../model/types';

export const SIMULATED_LATENCY_MS = 800;
const REFERENCE_LENGTH = 8;

function createAbortError(): DOMException {
  return new DOMException('The booking request was aborted.', 'AbortError');
}

/**
 * Stands in for `POST /bookings`. It honours an AbortSignal the same way `fetch` does, so the
 * caller can cancel it on unmount and swapping in a real request doesn't change the hook.
 */
export function submitBooking(
  request: BookingRequest,
  signal: AbortSignal,
): Promise<BookingConfirmation> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      const reference = crypto.randomUUID().slice(0, REFERENCE_LENGTH).toUpperCase();
      resolve({ reference, booking: request });
    }, SIMULATED_LATENCY_MS);

    function handleAbort(): void {
      clearTimeout(timer);
      reject(createAbortError());
    }
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}
