import { useEffect, useRef } from 'react';

// Long enough to swallow a double-click or a held-down Enter, short enough to go unnoticed.
export const ACTION_SWAP_GUARD_MS = 500;

// When a button's action changes under the pointer or focus (Cancel turning into Retry), the
// second half of a double-click or a repeated Enter would trigger the new action by accident.
// Returns a check that is true for a short time after `action` changes (not on first render).
export function useActionSwapGuard(action: string): () => boolean {
  const previousActionRef = useRef(action);
  const changedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (previousActionRef.current !== action) {
      previousActionRef.current = action;
      changedAtRef.current = Date.now();
    }
  }, [action]);

  return () => {
    const changedAt = changedAtRef.current;
    return changedAt !== null && Date.now() - changedAt < ACTION_SWAP_GUARD_MS;
  };
}
