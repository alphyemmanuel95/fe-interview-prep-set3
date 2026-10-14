import { useEffect, useState } from 'react';
import { toLocalIsoDate } from '../model/localDate';

function getMsUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextMidnight.getTime() - now.getTime();
}

/**
 * Today's local `YYYY-MM-DD`. It rolls over at local midnight so a page left open overnight
 * doesn't keep accepting yesterday, and render, validation and the reducer all share one value.
 */
export function useLocalToday(): string {
  const [today, setToday] = useState(() => toLocalIsoDate(new Date()));

  useEffect(() => {
    const timer = setTimeout(() => {
      setToday(toLocalIsoDate(new Date()));
    }, getMsUntilNextLocalMidnight(new Date()));
    return () => {
      clearTimeout(timer);
    };
  }, [today]);

  return today;
}
