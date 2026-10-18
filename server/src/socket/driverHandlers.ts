import { haversineKm } from '../utils/geo';
import { createIntervalGate } from '../utils/rateLimit';
import { driverLocationSchema, driverOnlineSchema } from '../utils/validate';
import { getRide, type RealtimeContext, type RealtimeSocket } from './context';
import { LIVE_RIDE_STATUSES, rooms, type DriverLocationUpdate, type VehicleType } from '../types';

/** Minimum gap between accepted GPS samples from one driver (stops floods, allows ~1 Hz). */
const MIN_SAMPLE_GAP_MS = 800;
const FIREBASE_DRIVER_GAP_MS = 5000;
const DB_POSITION_GAP_MS = 10_000;
const BREADCRUMB_GAP_MS = 4000;
/** Skip breadcrumbs when the car has barely moved (saves rows at red lights). */
const BREADCRUMB_MIN_MOVE_KM = 0.005;
/** After the last socket drops, wait this long before removing the driver from the live map. */
const OFFLINE_GRACE_MS = 20_000;

const sampleGate = createIntervalGate(MIN_SAMPLE_GAP_MS);
const firebaseDriverGate = createIntervalGate(FIREBASE_DRIVER_GAP_MS);
const dbPositionGate = createIntervalGate(DB_POSITION_GAP_MS);
const breadcrumbGate = createIntervalGate(BREADCRUMB_GAP_MS);
const lastBreadcrumb = new Map<string, { lat: number; lng: number }>();
const pendingOffline = new Map<string, NodeJS.Timeout>();

/**
 * Driver-only events: presence on the live map and the GPS stream.
 * Other roles never get these listeners registered, so a rider can't spoof a driver position.
 */
export function registerDriverHandlers(ctx: RealtimeContext, socket: RealtimeSocket): void {
  const { user } = socket.data;
  if (user.role !== 'driver') return;

  const { deps } = ctx;
  let vehicleType: VehicleType | null = null;

  // A reconnect within the grace period cancels the scheduled removal.
  const pending = pendingOffline.get(user.id);
  if (pending) {
    clearTimeout(pending);
    pendingOffline.delete(user.id);
  }

  socket.on('driver:online', async (raw) => {
    try {
      const input = driverOnlineSchema.safeParse(raw);
      if (!input.success) return;

      const presence = await deps.repository.getDriverPresence(user.id);
      if (!presence?.verified) {
        socket.emit('socket:error', { message: 'Your driver account is not verified yet.' });
        return;
      }

      vehicleType = presence.vehicleType; // trust the database, never the client
      await socket.join(rooms.onlineDrivers);
      const now = Date.now();
      await deps.liveStore.setDriverLocation(
        { driverId: user.id, lat: input.data.lat, lng: input.data.lng, heading: 0, speedKmh: 0, timestamp: now },
        vehicleType,
      );
    } catch (error) {
      deps.logger.error('driver:online failed', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
    }
  });

  socket.on('driver:offline', async () => {
    try {
      await socket.leave(rooms.onlineDrivers);
      await deps.liveStore.removeDriver(user.id);
    } catch (error) {
      deps.logger.error('driver:offline failed', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
    }
  });

  socket.on('driver:location:update', async (raw) => {
    try {
      const input = driverLocationSchema.safeParse(raw);
      if (!input.success) return;
      const now = Date.now();
      if (!sampleGate.allow(user.id, now)) return;

      const { lat, lng, heading, speedKmh, rideId } = input.data;
      const update: DriverLocationUpdate = { driverId: user.id, lat, lng, heading, speedKmh, timestamp: now, ...(rideId ? { rideId } : {}) };

      if (rideId) {
        // Only the assigned driver of a live ride may publish to its room.
        const ride = await getRide(ctx, rideId);
        if (!ride || ride.driverId !== user.id || !LIVE_RIDE_STATUSES.includes(ride.status)) {
          socket.emit('socket:error', { message: 'You are not the driver of an active ride with this id.' });
          return;
        }

        ctx.latestLocations.set(rideId, update);
        // volatile: if a rider's connection is momentarily down we drop the sample — the next one is 1 s away.
        ctx.io.to(rooms.ride(rideId)).volatile.emit('driver:location', update);
        void deps.liveStore.setRideLocation(update);

        // Permanent breadcrumb trail, sampled by time + movement.
        const previous = lastBreadcrumb.get(rideId);
        const moved = !previous || haversineKm(previous, { lat, lng }) >= BREADCRUMB_MIN_MOVE_KM;
        if (moved && breadcrumbGate.allow(rideId, now)) {
          lastBreadcrumb.set(rideId, { lat, lng });
          ctx.buffer.push({ rideId, driverId: user.id, lat, lng, heading, speedKmh, timestamp: now });
          void deps.liveStore.appendTrail(rideId, { lat, lng, t: now });
        }
      }

      if (firebaseDriverGate.allow(user.id, now)) void deps.liveStore.setDriverLocation(update, vehicleType);
      if (dbPositionGate.allow(user.id, now)) {
        deps.repository.saveDriverPosition(user.id, { lat, lng, heading }).catch((error: unknown) => {
          deps.logger.warn('saveDriverPosition failed', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
        });
      }
    } catch (error) {
      deps.logger.error('driver:location:update failed', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
    }
  });

  socket.on('disconnect', () => {
    if (ctx.presence.count(user.id) > 0) return; // still connected from another device
    // Wait before removing so a flaky mobile connection doesn't flicker the driver off the map.
    const timer = setTimeout(() => {
      pendingOffline.delete(user.id);
      if (ctx.presence.count(user.id) === 0) void deps.liveStore.removeDriver(user.id);
    }, OFFLINE_GRACE_MS);
    timer.unref();
    pendingOffline.set(user.id, timer);
  });
}

/** Forget per-ride throttling state once a ride is over. */
export function forgetRideTracking(rideId: string): void {
  breadcrumbGate.forget(rideId);
  lastBreadcrumb.delete(rideId);
}
