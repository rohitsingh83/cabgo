'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClientError, apiFetch } from '@/lib/api-client';
import type { FareEstimateResponse, Place } from '@/types';

/** Surge and driver supply move constantly — quotes are refreshed this often while on screen. */
const REFRESH_MS = 60_000;

interface Params {
  pickup: Place | null;
  dropoff: Place | null;
  /** Only fully-filled stops. */
  stops: Place[];
  promoCode: string | null;
}

interface State {
  data: FareEstimateResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches quotes for every vehicle type whenever the route (or promo code) changes.
 * Requests are debounced, stale responses are ignored via AbortController, and the quote is
 * silently refreshed every minute so the rider never confirms an outdated surge price.
 */
export function useFareEstimate({ pickup, dropoff, stops, promoCode }: Params) {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  // Stable key: only refetch when the actual coordinates / promo change.
  const key =
    pickup && dropoff
      ? JSON.stringify([
          [pickup.lat, pickup.lng],
          stops.map((s) => [s.lat, s.lng]),
          [dropoff.lat, dropoff.lng],
          promoCode,
        ])
      : null;

  const fetchEstimate = useCallback(
    async (silent: boolean) => {
      if (!pickup || !dropoff) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!silent) setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await apiFetch<FareEstimateResponse>('/api/fare-estimate', {
          method: 'POST',
          body: { pickup, dropoff, stops, ...(promoCode ? { promoCode } : {}) },
          signal: controller.signal,
        });
        setState({ data, loading: false, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof ApiClientError ? error.message : 'Could not load prices. Please try again.';
        // Keep the previous quote on a silent refresh failure; surface errors otherwise.
        setState((prev) => ({ data: silent ? prev.data : null, loading: false, error: silent ? null : message }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures pickup/dropoff/stops/promo
    [key],
  );

  useEffect(() => {
    if (!key) {
      abortRef.current?.abort();
      setState({ data: null, loading: false, error: null });
      return;
    }
    const debounce = setTimeout(() => void fetchEstimate(false), 350);
    const interval = setInterval(() => void fetchEstimate(true), REFRESH_MS);
    return () => {
      clearTimeout(debounce);
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [key, fetchEstimate]);

  return { ...state, refetch: () => fetchEstimate(false) };
}
