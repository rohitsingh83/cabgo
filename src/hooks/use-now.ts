'use client';

import { useEffect, useState } from 'react';

/** Current time, re-rendered every `intervalMs` (default 1 s) — drives countdowns and timers. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
