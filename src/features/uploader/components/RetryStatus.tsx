import { useEffect, useState } from 'react';
import { MAX_ATTEMPTS } from '../model/uploadQueue';

type RetryStatusProps = Readonly<{
  attempt: number;
  error: string;
  retryAt: number;
}>;

const MS_PER_SECOND = 1_000;
// Ticks faster than once a second so the shown value never lags the deadline by a whole second.
const COUNTDOWN_TICK_MS = 250;

// The countdown ticks in this row's text only. It is deliberately not part of the live region,
// which would otherwise announce every second.
export function RetryStatus({ attempt, error, retryAt }: RetryStatusProps): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, COUNTDOWN_TICK_MS);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((retryAt - now) / MS_PER_SECOND));
  return `Attempt ${attempt} of ${MAX_ATTEMPTS} failed (${error}). Retrying in ${secondsLeft} s`;
}
