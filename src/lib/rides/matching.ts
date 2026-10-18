import 'server-only';

import { BUSINESS_RULES } from '@/lib/constants';
import { createNotifications } from '@/lib/notifications';
import { emitRealtime, room, type RealtimeEvent } from '@/lib/realtime';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatCurrency } from '@/lib/utils';
import type { NearbyDriver, Ride, RideRequestPayload } from '@/types';

export interface DispatchResult {
  ride: Ride;
  driversNotified: number;
  searchRadiusKm: number;
}

async function findDrivers(ride: Ride, radiusKm: number): Promise<NearbyDriver[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc('find_nearby_drivers', {
    p_lat: ride.pickup_lat,
    p_lng: ride.pickup_lng,
    p_radius_km: radiusKm,
    p_ride_type: ride.ride_type,
    p_limit: 10,
  });
  if (error) throw new Error(`find_nearby_drivers failed: ${error.message}`);
  return data ?? [];
}

/**
 * Driver matching.
 *
 *  1. Look for idle, verified, online drivers of the requested type within 5 km.
 *  2. If nobody is there, widen once to the expanded radius (default 10 km).
 *  3. Drivers found → ride moves `requested → searching` and each driver gets a
 *     "new ride request" notification (the realtime layer also pushes the request live).
 *  4. Nobody found → ride stays `requested`; the rider can retry or cancel.
 *
 * "First driver to accept wins" is enforced atomically in the `accept_ride` SQL function.
 */
export async function dispatchRide(ride: Ride): Promise<DispatchResult> {
  const db = createSupabaseAdminClient();

  let radiusKm: number = BUSINESS_RULES.matchingRadiusKm;
  let drivers = await findDrivers(ride, radiusKm);

  if (drivers.length === 0 && BUSINESS_RULES.matchingExpandedRadiusKm > radiusKm) {
    radiusKm = BUSINESS_RULES.matchingExpandedRadiusKm;
    drivers = await findDrivers(ride, radiusKm);
  }

  if (drivers.length === 0) {
    // Let the rider's screen show "no drivers" immediately instead of waiting for the next poll.
    await emitRealtime({ rooms: [room.user(ride.rider_id)], event: 'ride:no-drivers', payload: { rideId: ride.id } });
    return { ride, driversNotified: 0, searchRadiusKm: radiusKm };
  }

  const { data: updated, error } = await db
    .from('rides')
    .update({ status: 'searching', search_radius_km: radiusKm })
    .eq('id', ride.id)
    .eq('status', 'requested') // never clobber a ride that was accepted/cancelled meanwhile
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to mark ride as searching: ${error.message}`);

  const current = updated ?? ride;
  const fare = formatCurrency(Number(current.estimated_fare));

  await createNotifications(
    drivers.map((driver) => ({
      userId: driver.driver_user_id,
      type: 'ride_requested' as const,
      title: 'New ride request',
      message: `${current.pickup_address} → ${current.dropoff_address} · ${fare} · ${driver.distance_km.toFixed(1)} km away`,
      data: { rideId: current.id, url: '/driver' },
    })),
  );

  // Push the request itself so drivers see it instantly (the stored notification above is the fallback).
  const { data: rider } = await db.from('users').select('id, full_name, avatar_url').eq('id', current.rider_id).maybeSingle();
  if (rider) {
    const requests: RealtimeEvent[] = drivers.map((driver) => {
      const payload: RideRequestPayload = {
        ride: current,
        rider,
        distanceToPickupKm: driver.distance_km,
        expiresInSeconds: BUSINESS_RULES.matchingTimeoutSeconds,
      };
      return { rooms: [room.user(driver.driver_user_id)], event: 'ride:request', payload };
    });
    await emitRealtime(requests);
  }

  return { ride: current, driversNotified: drivers.length, searchRadiusKm: radiusKm };
}
