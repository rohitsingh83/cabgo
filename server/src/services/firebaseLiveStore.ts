import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

import type { FirebaseAdminConfig } from '../config';
import type { LiveStore } from '../deps';
import type { Logger } from '../lib/logger';

/**
 * Realtime Database layout (must match src/lib/firebase/realtime.ts in the Next.js app):
 *
 *   driverLocations/{driverUserId}      → latest position of an online driver
 *   rides/{rideId}/driverLocation       → latest position for the rider's tracking screen
 *   rides/{rideId}/status               → { status, updatedAt }
 *   rides/{rideId}/trail/{pushId}       → breadcrumb { lat, lng, t }
 *   rideParticipants/{rideId}/{userId}  → true for the rider and the driver (read-access list for the rules)
 *
 * The Admin SDK bypasses the security rules, so this process is the authoritative writer.
 */
export function createFirebaseLiveStore(config: FirebaseAdminConfig, logger: Logger): LiveStore {
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId: config.projectId, clientEmail: config.clientEmail, privateKey: config.privateKey }),
      databaseURL: config.databaseUrl,
    });
  const db = getDatabase(app);
  const auth = getAuth(app);

  /** Mirror writes are best-effort: a Firebase hiccup must never break live tracking. */
  const safely = async (label: string, work: () => PromiseLike<unknown>): Promise<void> => {
    try {
      await work();
    } catch (error) {
      logger.warn(`firebase ${label} failed`, { error: error instanceof Error ? error.message : String(error) });
    }
  };

  return {
    enabled: true,

    setDriverLocation: (update, vehicleType) =>
      safely('setDriverLocation', () =>
        db.ref(`driverLocations/${update.driverId}`).update({
          lat: update.lat,
          lng: update.lng,
          heading: update.heading,
          speedKmh: update.speedKmh,
          online: true,
          updatedAt: update.timestamp,
          ...(vehicleType ? { vehicleType } : {}),
        }),
      ),

    removeDriver: (driverId) => safely('removeDriver', () => db.ref(`driverLocations/${driverId}`).remove()),

    setRideLocation: (update) =>
      safely('setRideLocation', () =>
        db.ref(`rides/${update.rideId}/driverLocation`).set({
          lat: update.lat,
          lng: update.lng,
          heading: update.heading,
          speedKmh: update.speedKmh,
          updatedAt: update.timestamp,
          driverId: update.driverId,
        }),
      ),

    appendTrail: (rideId, point) => safely('appendTrail', () => db.ref(`rides/${rideId}/trail`).push(point)),

    setRideStatus: (rideId, status, participantIds) =>
      safely('setRideStatus', () => {
        // One atomic multi-path write: the status and the access list never disagree.
        const updates: Record<string, unknown> = { [`rides/${rideId}/status`]: { status, updatedAt: Date.now() } };
        for (const id of participantIds) updates[`rideParticipants/${rideId}/${id}`] = true;
        return db.ref().update(updates);
      }),

    clearRide: (rideId) =>
      safely('clearRide', () => db.ref().update({ [`rides/${rideId}`]: null, [`rideParticipants/${rideId}`]: null })),

    async issueToken(userId, role) {
      try {
        return await auth.createCustomToken(userId, { role });
      } catch (error) {
        logger.warn('firebase custom token failed', { error: error instanceof Error ? error.message : String(error) });
        return null;
      }
    },
  };
}

/** Used when Firebase credentials are not configured — the app runs on Socket.IO + Supabase only. */
export const noopLiveStore: LiveStore = {
  enabled: false,
  setDriverLocation: async () => undefined,
  removeDriver: async () => undefined,
  setRideLocation: async () => undefined,
  appendTrail: async () => undefined,
  setRideStatus: async () => undefined,
  clearRide: async () => undefined,
  issueToken: async () => null,
};
