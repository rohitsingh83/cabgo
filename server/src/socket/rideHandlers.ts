import { createRateLimiter } from '../utils/rateLimit';
import { rideRoomSchema } from '../utils/validate';
import { getRide, type RealtimeContext, type RealtimeSocket } from './context';
import { rooms } from '../types';

const MAX_RIDE_ROOMS_PER_SOCKET = 10;
const joinLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/**
 * Ride rooms: only the rider, the assigned driver and admins may listen to a ride.
 * Membership is checked against Postgres on every join — knowing a ride id is not enough.
 */
export function registerRideHandlers(ctx: RealtimeContext, socket: RealtimeSocket): void {
  const { user } = socket.data;

  socket.on('ride:join', async (raw, ack) => {
    const respond = (ok: boolean) => {
      if (typeof ack === 'function') ack(ok);
    };

    try {
      const input = rideRoomSchema.safeParse(raw);
      if (!input.success || !joinLimiter.take(user.id)) return respond(false);

      const joined = [...socket.rooms].filter((room) => room.startsWith('ride:')).length;
      if (joined >= MAX_RIDE_ROOMS_PER_SOCKET) return respond(false);

      const ride = await getRide(ctx, input.data.rideId);
      const allowed = ride !== null && (user.role === 'admin' || ride.riderId === user.id || ride.driverId === user.id);
      if (!allowed) return respond(false);

      await socket.join(rooms.ride(input.data.rideId));

      // A rider who opens the screen mid-trip should see the car immediately, not after the next sample.
      const latest = ctx.latestLocations.get(input.data.rideId);
      if (latest) socket.emit('driver:location', latest);
      return respond(true);
    } catch (error) {
      ctx.deps.logger.error('ride:join failed', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
      return respond(false);
    }
  });

  socket.on('ride:leave', async (raw) => {
    const input = rideRoomSchema.safeParse(raw);
    if (input.success) await socket.leave(rooms.ride(input.data.rideId));
  });
}
