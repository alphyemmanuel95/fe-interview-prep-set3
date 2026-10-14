import { useEffect, useState } from 'react';
import { toLocalIsoDate } from '../model/localDate';

function getMsUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextMidnight.getTime() - now.getTime();
}

/**
 * Today's local `YYYY-MM-DD` for rendering (the date input's `min` and live error messages).
 * It rolls over at local midnight so a page left open overnight stays current. The Next and
 * Confirm gates don't rely on it: they read the clock themselves at the moment of the action.
 */
export function useLocalToday(): string {
  const [today, setToday] = useState(() => toLocalIsoDate(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function scheduleRollover(): void {
      timer = setTimeout(() => {
        const current = toLocalIsoDate(new Date());
        // A timer can fire before the day has changed (sleep, clock or DST adjustments). Setting
        // the same string would bail out of a re-render and never schedule again, so re-arm instead.
        if (current === today) {
          scheduleRollover();
        } else {
          setToday(current);
        }
      }, getMsUntilNextLocalMidnight(new Date()));
    }
    scheduleRollover();
    return () => {
      clearTimeout(timer);
    };
  }, [today]);

  return today;
}
