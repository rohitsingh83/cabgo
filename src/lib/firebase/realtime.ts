import { signInWithCustomToken } from 'firebase/auth';
import {
  get,
  off,
  onValue,
  ref,
  serverTimestamp,
  type DataSnapshot,
  type Unsubscribe,
} from 'firebase/database';

import { FIREBASE_PATHS } from '@/lib/constants';
import { haversineKm } from '@/lib/utils';
import { getFirebaseAuth, getRealtimeDatabase, isFirebaseConfigured } from '@/lib/firebase/config';
import type { LatLng, RideStatus, VehicleType } from '@/types';

/**
 * Realtime Database layout
 *
 *  driverLocations/{driverId}            → { lat, lng, heading, speedKmh, vehicleType, updatedAt, online }
 *  rides/{rideId}/driverLocation         → latest DriverLocationUpdate
 *  rides/{rideId}/status                 → { status, updatedAt }
 *  rides/{rideId}/trail/{pushId}         → breadcrumb { lat, lng, t }
 *
 * The Express/Socket.IO server (Admin SDK) is the ONLY writer — the security rules deny every browser
 * write — so this module is read-only. Reads are limited to the ride's participants (see
 * `database.rules.json`: `rideParticipants/{rideId}/{userId}`).
 */

/* ---------------------------------------------------------------------- */
/* Auth                                                                    */
/* ---------------------------------------------------------------------- */

/** Sign the browser into Firebase with a custom token minted by our backend. */
export async function ensureFirebaseAuth(customToken: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const auth = getFirebaseAuth();
  if (auth.currentUser) return;
  await signInWithCustomToken(auth, customToken);
}

/* ---------------------------------------------------------------------- */
/* Shapes                                                                  */
/* ---------------------------------------------------------------------- */

export interface StoredDriverLocation extends LatLng {
  heading: number;
  speedKmh: number;
  vehicleType?: VehicleType;
  online?: boolean;
  /** Epoch ms (client clock) — used to ignore stale entries. */
  updatedAt: number;
}

export interface StoredRideStatus {
  status: RideStatus;
  updatedAt: number;
}

export interface OnlineDriverSnapshot extends StoredDriverLocation {
  driverId: string;
  distanceKm: number;
}

/* ---------------------------------------------------------------------- */
/* Reads / subscriptions                                                   */
/* ---------------------------------------------------------------------- */

/**
 * Subscribe to the live driver position of a ride.
 * @returns unsubscribe function
 */
export function subscribeToRideLocation(
  rideId: string,
  callback: (location: (StoredDriverLocation & { driverId?: string }) | null) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => undefined;
  }
  const locationRef = ref(getRealtimeDatabase(), `${FIREBASE_PATHS.rides}/${rideId}/driverLocation`);
  const handler = (snapshot: DataSnapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as StoredDriverLocation & { driverId?: string }) : null);
  };
  onValue(locationRef, handler);
  return () => off(locationRef, 'value', handler);
}

/** Subscribe to status changes of a ride (secondary channel to Socket.IO). */
export function subscribeToRideStatus(
  rideId: string,
  callback: (status: StoredRideStatus | null) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => undefined;
  }
  const statusRef = ref(getRealtimeDatabase(), `${FIREBASE_PATHS.rides}/${rideId}/status`);
  const handler = (snapshot: DataSnapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as StoredRideStatus) : null);
  };
  onValue(statusRef, handler);
  return () => off(statusRef, 'value', handler);
}

/** Read the persisted breadcrumb trail (e.g. to redraw the route after a page refresh). */
export async function getRideTrail(rideId: string): Promise<LatLng[]> {
  if (!isFirebaseConfigured()) return [];
  const snapshot = await get(ref(getRealtimeDatabase(), `${FIREBASE_PATHS.rides}/${rideId}/trail`));
  if (!snapshot.exists()) return [];
  const points: LatLng[] = [];
  snapshot.forEach((child) => {
    const value = child.val() as { lat: number; lng: number } | null;
    if (value) points.push({ lat: value.lat, lng: value.lng });
  });
  return points;
}

/**
 * Subscribe to all online drivers within `radiusKm` of a point (live "cars around you").
 * Entries not updated within `maxAgeMs` are treated as stale and ignored.
 */
export function subscribeToNearbyDrivers(
  center: LatLng,
  radiusKm: number,
  callback: (drivers: OnlineDriverSnapshot[]) => void,
  options: { vehicleType?: VehicleType; maxAgeMs?: number } = {},
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    callback([]);
    return () => undefined;
  }
  const { vehicleType, maxAgeMs = 60_000 } = options;
  const driversRef = ref(getRealtimeDatabase(), FIREBASE_PATHS.driverLocations);

  const handler = (snapshot: DataSnapshot) => {
    const now = Date.now();
    const nearby: OnlineDriverSnapshot[] = [];
    snapshot.forEach((child) => {
      const value = child.val() as StoredDriverLocation | null;
      if (!value || value.online === false) return;
      if (now - value.updatedAt > maxAgeMs) return;
      if (vehicleType && value.vehicleType !== vehicleType) return;
      const distanceKm = haversineKm(center, { lat: value.lat, lng: value.lng });
      if (distanceKm <= radiusKm && child.key) {
        nearby.push({ ...value, driverId: child.key, distanceKm });
      }
    });
    nearby.sort((a, b) => a.distanceKm - b.distanceKm);
    callback(nearby);
  };

  onValue(driversRef, handler);
  return () => off(driversRef, 'value', handler);
}

/** Server-side timestamp sentinel for callers that want Firebase's clock. */
export const firebaseServerTimestamp = serverTimestamp;
