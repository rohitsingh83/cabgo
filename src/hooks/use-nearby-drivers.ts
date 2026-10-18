'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api-client';
import type { LatLng, NearbyDriverMarker, VehicleType } from '@/types';

const POLL_MS = 10_000;

/** Polls anonymous nearby drivers around `center` for the "cars near you" map layer. */
export function useNearbyDrivers(center: LatLng | null, rideType?: VehicleType | null): NearbyDriverMarker[] {
  const [drivers, setDrivers] = useState<NearbyDriverMarker[]>([]);
  const lat = center?.lat;
  const lng = center?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      setDrivers([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
        if (rideType) params.set('rideType', rideType);
        const markers = await apiFetch<NearbyDriverMarker[]>(`/api/drivers/nearby?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!cancelled) setDrivers(markers);
      } catch {
        // Map decoration only — a failed poll keeps the previous markers.
      }
    };

    void load();
    const interval = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [lat, lng, rideType]);

  return drivers;
}
