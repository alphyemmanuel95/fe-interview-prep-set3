import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Focuses the returned element whenever `value` changes, but not on first render, so landing on
 * the page (or restoring a draft) doesn't steal focus. Used to move focus to each new step heading.
 */
export function useFocusOnChange<TElement extends HTMLElement>(
  value: string,
): RefObject<TElement | null> {
  const elementRef = useRef<TElement>(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }
    previousValueRef.current = value;
    elementRef.current?.focus();
  }, [value]);

  return elementRef;
}
