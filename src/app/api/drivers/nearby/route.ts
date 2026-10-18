import { ok, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { nearbyDriversQuerySchema } from '@/lib/validations';
import type { NearbyDriverMarker } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/drivers/nearby?lat=&lng=&rideType=&radiusKm=
 * Anonymous drivers around a point, for the "cars near you" layer of the booking map.
 * Only position, heading and vehicle type are exposed — no names, plates or user ids.
 */
export const GET = withApi(async (request) => {
  await requireApiUser(['rider']);
  const query = parseQuery(request, nearbyDriversQuerySchema);

  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc('find_nearby_drivers', {
    p_lat: query.lat,
    p_lng: query.lng,
    p_radius_km: query.radiusKm,
    p_ride_type: query.rideType ?? null,
    p_limit: 30,
  });
  if (error) throw new Error(`find_nearby_drivers failed: ${error.message}`);

  const markers: NearbyDriverMarker[] = (data ?? []).map((driver) => ({
    id: driver.driver_profile_id,
    // ~1 m precision is plenty for a map marker and avoids over-sharing exact positions.
    lat: Number(driver.current_lat.toFixed(5)),
    lng: Number(driver.current_lng.toFixed(5)),
    heading: driver.current_heading,
    vehicleType: driver.vehicle_type,
    distanceKm: Number(driver.distance_km.toFixed(2)),
  }));

  return ok(markers);
}, 'GET /api/drivers/nearby');
