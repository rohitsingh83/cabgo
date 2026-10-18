import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { RideWithRelations, User } from '@/types';

/**
 * Load a ride with the rider, driver (+ vehicle) and payment/rating attached.
 * Uses the service-role client — callers MUST check access with `canAccessRide`.
 */
export async function getRideWithRelations(rideId: string): Promise<RideWithRelations | null> {
  const db = createSupabaseAdminClient();

  const { data: ride, error } = await db.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);
  if (!ride) return null;

  const userIds = [ride.rider_id, ride.driver_id].filter((id): id is string => Boolean(id));

  const [usersResult, profileResult, paymentResult, ratingResult] = await Promise.all([
    db.from('users').select('id, full_name, avatar_url, phone').in('id', userIds),
    ride.driver_id
      ? db
          .from('driver_profiles')
          .select('vehicle_type, vehicle_model, vehicle_color, vehicle_plate, average_rating, total_rides, current_lat, current_lng, current_heading')
          .eq('user_id', ride.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('payments').select('*').eq('ride_id', ride.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('ratings').select('*').eq('ride_id', ride.id).eq('from_user_id', ride.rider_id).maybeSingle(),
  ]);

  if (usersResult.error) throw new Error(`Failed to load ride users: ${usersResult.error.message}`);

  const users = usersResult.data ?? [];
  return {
    ...ride,
    rider: users.find((u) => u.id === ride.rider_id) ?? null,
    driver: users.find((u) => u.id === ride.driver_id) ?? null,
    driver_profile: profileResult.data ?? null,
    payment: paymentResult.data ?? null,
    rating: ratingResult.data ?? null,
  };
}

/** Riders see their own rides, drivers the rides they were assigned, admins everything. */
export function canAccessRide(user: User, ride: { rider_id: string; driver_id: string | null }): boolean {
  return user.role === 'admin' || ride.rider_id === user.id || ride.driver_id === user.id;
}
