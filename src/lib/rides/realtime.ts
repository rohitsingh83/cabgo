import 'server-only';

import { emitRealtime, room, type RealtimeEvent } from '@/lib/realtime';
import type { Ride, RideStatusPayload } from '@/types';

type RideRef = Pick<Ride, 'id' | 'rider_id' | 'driver_id' | 'status' | 'cancellation_reason'>;

/**
 * Tell everyone involved in a ride that its state changed.
 * One emit addresses the ride room AND both users' personal rooms; Socket.IO delivers it once per
 * socket even if that socket is in several of the rooms, so the tracking screen (in the ride
 * room) and any other open tab (user room) both update.
 */
export async function publishRideEvent(
  ride: RideRef,
  event: 'ride:accepted' | 'ride:status' | 'ride:cancelled',
): Promise<void> {
  const payload: RideStatusPayload = {
    rideId: ride.id,
    status: ride.status,
    driverId: ride.driver_id,
    at: new Date().toISOString(),
    reason: ride.cancellation_reason,
  };

  const rooms = [room.ride(ride.id), room.user(ride.rider_id)];
  if (ride.driver_id) rooms.push(room.user(ride.driver_id));

  const events: RealtimeEvent[] = [{ rooms, event, payload }];
  await emitRealtime(events);
}

/** Drivers that were offered a ride should drop it when it is taken or cancelled. */
export async function publishRideClosed(rideId: string, reason: 'taken' | 'expired'): Promise<void> {
  await emitRealtime({
    rooms: [room.onlineDrivers],
    event: reason === 'taken' ? 'ride:taken' : 'ride:request:expired',
    payload: { rideId },
  });
}
