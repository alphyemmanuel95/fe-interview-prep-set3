import { useEffect } from 'react';

// Asks the browser to confirm leaving the page while `shouldWarn` is true. The listener is only
// attached while needed: an always-on beforeunload handler also disables the back/forward cache.
export function useBeforeUnloadWarning(shouldWarn: boolean): void {
  useEffect(() => {
    if (!shouldWarn) {
      return undefined;
    }
    // preventDefault() is the standard way to trigger the prompt; browsers show their own text.
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldWarn]);
}
