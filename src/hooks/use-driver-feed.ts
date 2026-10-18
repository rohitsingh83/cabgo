'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealtime } from '@/hooks/use-realtime';
import { apiFetch } from '@/lib/api-client';
import type { DriverFeed } from '@/types';

/**
 * Keeps the driver dashboard fresh by polling /api/driver/feed.
 * Polling is fast while a trip or requests matter and slow while offline (just enough to notice
 * an admin approving the account). It pauses while the tab is hidden.
 * While the realtime socket is connected, events trigger refreshes (see DriverConsole) and
 * polling only runs as a slow consistency check.
 */
export function useDriverFeed(initial: DriverFeed) {
  const [feed, setFeed] = useState<DriverFeed>(initial);
  const [error, setError] = useState<string | null>(null);
  const failures = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const next = await apiFetch<DriverFeed>('/api/driver/feed');
      failures.current = 0;
      setError(null);
      setFeed(next);
    } catch {
      failures.current += 1;
      if (failures.current >= 3) setError('Connection problem — requests may be delayed.');
    }
  }, []);

  const { status } = useRealtime();
  const socketUp = status === 'connected';
  const intervalMs = socketUp
    ? feed.activeRide ? 15_000 : feed.profile.is_online ? 20_000 : 30_000
    : feed.activeRide ? 4000 : feed.profile.is_online ? 5000 : 15_000;

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, refresh]);

  return { feed, setFeed, error, refresh };
}
