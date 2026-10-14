import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Focuses the returned element only when `count` goes up. Tying focus to a counter instead of to
 * the element mounting matters for the error summary: it unmounts and remounts as the user types
 * a field valid and invalid again, and focus must not be pulled out of the field mid-edit.
 */
export function useFocusOnIncrease<TElement extends HTMLElement>(
  count: number,
): RefObject<TElement | null> {
  const elementRef = useRef<TElement>(null);
  // Starts at the initial count so a restored state doesn't steal focus on page load.
  const previousCountRef = useRef(count);

  useEffect(() => {
    const hasIncreased = count > previousCountRef.current;
    previousCountRef.current = count;
    if (hasIncreased) {
      elementRef.current?.focus();
    }
  }, [count]);

  return elementRef;
}
