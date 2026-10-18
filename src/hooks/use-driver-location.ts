'use client';

import { useEffect, useRef, useState } from 'react';

import { useRealtime } from '@/hooks/use-realtime';
import { apiFetch } from '@/lib/api-client';
import { bearingDegrees, haversineKm } from '@/lib/utils';

export interface DriverPosition {
  lat: number;
  lng: number;
  heading: number | null;
}

/**
 * REST uploads keep `driver_profiles.current_*` fresh for matching. They are the only channel when
 * the socket is down (every 8 s); while it is up the server persists positions itself, so REST
 * drops to a 30 s heartbeat.
 */
const UPLOAD_EVERY_MS = 8000;
const UPLOAD_EVERY_MS_SOCKET = 30_000;
const MIN_MOVE_KM = 0.015;
const MAX_AGE_MS = 30_000;
/** Gap between Socket.IO samples (the server accepts roughly one per second). */
const STREAM_EVERY_MS = 2000;

/**
 * Watches the device position while `enabled`.
 *  - Streams it over Socket.IO (≈ every 2 s) so riders see the car move, tagged with `rideId`
 *    while a trip is active.
 *  - Uploads it (throttled) to /api/driver/location as a persistent fallback.
 * Heading comes from the GPS when moving, otherwise from the bearing between the last two fixes.
 */
export function useDriverLocation(enabled: boolean, rideId?: string | null) {
  const { socket, status } = useRealtime();
  const socketRef = useRef(socket);
  socketRef.current = status === 'connected' ? socket : null;
  const rideIdRef = useRef(rideId ?? null);
  rideIdRef.current = rideId ?? null;
  const lastStream = useRef(0);

  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastUpload = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const lastFix = useRef<DriverPosition | null>(null);

  useEffect(() => {
    if (!enabled) {
      setError(null);
      lastUpload.current = null;
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not supported on this device.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (geo) => {
        setError(null);
        const { latitude: lat, longitude: lng, heading: gpsHeading } = geo.coords;
        const previous = lastFix.current;
        let heading: number | null = typeof gpsHeading === 'number' && !Number.isNaN(gpsHeading) ? gpsHeading : null;
        if (heading === null && previous && haversineKm(previous, { lat, lng }) > 0.005) {
          heading = bearingDegrees(previous, { lat, lng });
        }
        heading ??= previous?.heading ?? null;

        const fix: DriverPosition = { lat, lng, heading };
        lastFix.current = fix;
        setPosition(fix);

        const now = Date.now();

        // Live stream (fire-and-forget; the server throttles and validates).
        const live = socketRef.current;
        if (live && now - lastStream.current >= STREAM_EVERY_MS) {
          lastStream.current = now;
          const speedMs = geo.coords.speed;
          live.emit('driver:location:update', {
            lat,
            lng,
            heading: heading ?? 0,
            speedKmh: typeof speedMs === 'number' && Number.isFinite(speedMs) ? Math.max(0, speedMs * 3.6) : 0,
            ...(rideIdRef.current ? { rideId: rideIdRef.current } : {}),
          });
        }

        const sent = lastUpload.current;
        const uploadEvery = live ? UPLOAD_EVERY_MS_SOCKET : UPLOAD_EVERY_MS;
        const due =
          !sent ||
          (now - sent.at >= uploadEvery &&
            (haversineKm(sent, { lat, lng }) >= MIN_MOVE_KM || now - sent.at >= MAX_AGE_MS));
        if (!due) return;

        lastUpload.current = { at: now, lat, lng };
        // Fire-and-forget: a missed upload is replaced by the next one.
        apiFetch('/api/driver/location', { method: 'POST', body: { lat, lng, heading } }).catch(() => undefined);
      },
      (failure) => {
        setError(
          failure.code === failure.PERMISSION_DENIED
            ? 'Location access is blocked. Allow it in your browser settings so riders can find you.'
            : 'Waiting for a GPS signal…',
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  /* ----- presence: tell the realtime server when this driver is on / off the live map ----- */
  const hasFix = position !== null;
  const latest = useRef(position);
  latest.current = position;
  useEffect(() => {
    if (!socket || status !== 'connected' || !enabled || !hasFix) return;
    const fix = latest.current;
    if (fix) socket.emit('driver:online', { lat: fix.lat, lng: fix.lng });
    return () => {
      // `enabled` flipped off, or the socket dropped (the server also cleans up on disconnect).
      if (socket.connected) socket.emit('driver:offline');
    };
  }, [socket, status, enabled, hasFix]);

  return { position, error };
}
