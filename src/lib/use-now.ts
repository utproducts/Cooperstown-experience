import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `intervalMs` so time-based UI stays fresh. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
