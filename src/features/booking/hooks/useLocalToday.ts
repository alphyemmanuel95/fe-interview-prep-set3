import { useEffect, useState } from 'react';
import { toLocalIsoDate } from '../model/localDate';

function getMsUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextMidnight.getTime() - now.getTime();
}

/**
 * Today's local `YYYY-MM-DD`, plus `refreshToday` for the Next and Confirm gates.
 * - The value rolls over at local midnight, so a page left open overnight stays current.
 * - `refreshToday` reads the clock at the moment of the action and stores the result, so the
 *   gate's decision and the errors rendered afterwards always use the same date.
 */
export function useLocalToday(): readonly [today: string, refreshToday: () => string] {
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

  function refreshToday(): string {
    const current = toLocalIsoDate(new Date());
    setToday(current);
    return current;
  }

  return [today, refreshToday];
}
