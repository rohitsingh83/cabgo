'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/clerk-client';

import { useRealtime, useSocketEvent } from '@/hooks/use-realtime';
import type { RideStatusPayload } from '@/types';

export interface LiveDriverLocation {
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  /** Epoch ms of the GPS fix. */
  updatedAt: number;
}

/** How the screen is currently receiving updates. */
export type LiveChannel = 'socket' | 'firebase' | 'polling';

interface UseRideLiveOptions {
  rideId: string;
  /** Only subscribe while the ride has a driver and is not finished. */
  enabled: boolean;
  /** Called whenever the ride's state changes on the server (refetch the ride). */
  onRideEvent: () => void;
}

/** If the socket has not connected after this long, try the Firebase fallback. */
const FALLBACK_DELAY_MS = 4000;

/**
 * Live driver location + ride events for ONE ride, over three layers (best first):
 *   1. Socket.IO  — join the ride room; ~1 s updates
 *   2. Firebase   — Realtime Database listener, used while the socket is down
 *   3. polling    — the caller keeps polling the REST API regardless (see RideTracker)
 */
export function useRideLive({ rideId, enabled, onRideEvent }: UseRideLiveOptions) {
  const { socket, status } = useRealtime();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [location, setLocation] = useState<LiveDriverLocation | null>(null);
  const [firebaseActive, setFirebaseActive] = useState(false);

  const socketLive = status === 'connected';

  /* ----- 1. Socket.IO: join the ride room (again after every reconnect) ----- */
  useEffect(() => {
    if (!socket || !enabled || !socketLive) return;
    socket.emit('ride:join', { rideId });
    return () => {
      socket.emit('ride:leave', { rideId });
    };
  }, [socket, enabled, socketLive, rideId]);

  useSocketEvent(
    'driver:location',
    (update) => {
      if (update.rideId && update.rideId !== rideId) return;
      setLocation((previous) =>
        // Ignore out-of-order samples.
        previous && previous.updatedAt > update.timestamp
          ? previous
          : { lat: update.lat, lng: update.lng, heading: update.heading, speedKmh: update.speedKmh, updatedAt: update.timestamp },
      );
    },
    enabled,
  );

  const onEvent = (payload: RideStatusPayload) => {
    if (payload.rideId === rideId) onRideEvent();
  };
  useSocketEvent('ride:accepted', onEvent, enabled);
  useSocketEvent('ride:status', onEvent, enabled);
  useSocketEvent('ride:cancelled', onEvent, enabled);

  /* ----- 2. Firebase fallback while the socket is down ----- */
  useEffect(() => {
    if (!enabled || socketLive) {
      setFirebaseActive(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const timer = setTimeout(async () => {
      // Loaded on demand: the Firebase SDK is ~80 kB and most sessions never need the fallback.
      const [{ signInToFirebase }, { subscribeToRideLocation }] = await Promise.all([
        import('@/lib/firebase/session'),
        import('@/lib/firebase/realtime'),
      ]);
      if (cancelled) return;
      const signedIn = await signInToFirebase(() => getTokenRef.current());
      if (cancelled || !signedIn) return;
      setFirebaseActive(true);
      unsubscribe = subscribeToRideLocation(rideId, (value) => {
        if (!value) return;
        setLocation((previous) =>
          previous && previous.updatedAt > value.updatedAt
            ? previous
            : { lat: value.lat, lng: value.lng, heading: value.heading ?? 0, speedKmh: value.speedKmh ?? 0, updatedAt: value.updatedAt },
        );
      });
    }, FALLBACK_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe?.();
      setFirebaseActive(false);
    };
  }, [enabled, socketLive, rideId]);

  const channel: LiveChannel = socketLive ? 'socket' : firebaseActive ? 'firebase' : 'polling';
  return { location, channel, connected: socketLive };
}
