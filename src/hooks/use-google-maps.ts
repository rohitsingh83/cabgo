'use client';

import { useEffect, useState } from 'react';

import { getMapsApiKey, isMapsKeyConfigured, loadGoogleMaps, resetGoogleMapsLoader } from '@/lib/google-maps/loader';

export type MapsStatus = 'loading' | 'ready' | 'unconfigured' | 'error';

/** Lazily loads Google Maps and reports its state to the calling component. */
export function useGoogleMaps(): { status: MapsStatus; error: string | null; apiKey: string; retry: () => void } {
  const [status, setStatus] = useState<MapsStatus>(isMapsKeyConfigured() ? 'loading' : 'unconfigured');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const handleKeyChange = () => {
      resetGoogleMapsLoader();
      setAttempt((n) => n + 1);
    };
    window.addEventListener('cabgo:maps-key-changed', handleKeyChange);
    return () => window.removeEventListener('cabgo:maps-key-changed', handleKeyChange);
  }, []);

  useEffect(() => {
    if (!isMapsKeyConfigured()) {
      setStatus('unconfigured');
      setError(null);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(null);
    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setStatus('ready');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : 'Failed to load Google Maps');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { status, error, apiKey: getMapsApiKey(), retry: () => setAttempt((n) => n + 1) };
}
