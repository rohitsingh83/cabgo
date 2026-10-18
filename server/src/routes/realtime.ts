import { Router } from 'express';
import { z } from 'zod';

import type { Deps } from '../deps';
import { forgetRideTracking } from '../socket/driverHandlers';
import { invalidateRide } from '../socket/context';
import type { SocketLayer } from '../socket';
import { RELAYED_EVENTS, TERMINAL_RIDE_STATUSES, type RideStatus } from '../types';
import { uuidSchema } from '../utils/validate';

/** Room names a caller may target — validated so a bug upstream can never address arbitrary rooms. */
const ROOM_PATTERN = /^(user|ride):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^drivers:online$|^role:(admin|driver|rider)$/i;

const emitSchema = z.object({
  events: z
    .array(
      z.object({
        rooms: z.array(z.string().regex(ROOM_PATTERN)).min(1).max(100),
        event: z.enum(RELAYED_EVENTS),
        payload: z.record(z.unknown()),
      }),
    )
    .min(1)
    .max(100),
});

const statusSchema = z.enum(['requested', 'searching', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled']);
const rideEventSchema = z.object({ rideId: uuidSchema, status: statusSchema });

/** How long finished-ride data stays in Firebase before it is deleted (lets clients render the final state). */
const FIREBASE_CLEANUP_DELAY_MS = 2 * 60 * 1000;

/**
 * POST /realtime/emit — called by the Next.js API routes (authenticated with the shared secret)
 * to push events to browsers: notifications, new ride requests, status changes …
 *
 * Next.js remains the single place where business rules and DB writes live; this server only
 * fans results out to the right rooms.
 */
export function createRealtimeRouter(layer: SocketLayer, deps: Deps): Router {
  const router = Router();

  router.post('/emit', (request, response) => {
    const parsed = emitSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ success: false, error: 'Invalid payload' });
      return;
    }

    for (const item of parsed.data.events) {
      // socket.io's emit is strictly typed per event; the payload was relayed from a trusted backend.
      const target = layer.io.to(item.rooms) as unknown as { emit: (event: string, payload: unknown) => boolean };
      target.emit(item.event, item.payload);
      afterRideEvent(layer, deps, item.event, item.payload, item.rooms);
    }

    response.json({ success: true, data: { delivered: parsed.data.events.length } });
  });

  return router;
}

/** Keeps caches and the Firebase mirror in step with ride lifecycle events. */
const USER_ROOM = /^user:([0-9a-f-]{36})$/i;

/** Events whose rooms are exactly the ride's own participants ('ride:taken' goes to *other* drivers, so it is excluded). */
const PARTICIPANT_EVENTS = new Set(['ride:accepted', 'ride:status', 'ride:cancelled']);

function afterRideEvent(layer: SocketLayer, deps: Deps, event: string, payload: Record<string, unknown>, rooms: string[]): void {
  if (!PARTICIPANT_EVENTS.has(event)) return;
  const parsed = rideEventSchema.safeParse(payload);
  if (!parsed.success) return;

  const { rideId } = parsed.data;
  const status: RideStatus = parsed.data.status;
  invalidateRide(layer.ctx, rideId); // participants/status changed — drop the cached lookup
  // The rider and driver are addressed through their personal rooms; those ids become the Firebase read-access list.
  const participantIds = rooms.map((room) => USER_ROOM.exec(room)?.[1]).filter((id): id is string => Boolean(id));
  void deps.liveStore.setRideStatus(rideId, status, participantIds);

  if (TERMINAL_RIDE_STATUSES.includes(status)) {
    layer.ctx.latestLocations.delete(rideId);
    forgetRideTracking(rideId);
    // Push anything still buffered so the trail is complete, then tidy Firebase later.
    void layer.ctx.buffer.flush();
    setTimeout(() => void deps.liveStore.clearRide(rideId), FIREBASE_CLEANUP_DELAY_MS).unref();
  }
}
