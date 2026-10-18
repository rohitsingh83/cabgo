import { ApiError, ok, parseParam, requireApiUser, withApi } from '@/lib/api';
import { dispatchRide } from '@/lib/rides/matching';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { uuidSchema } from '@/lib/validations';
import type { CreateRideResult } from '@/types';

/**
 * POST /api/rides/[id]/search
 *
 * "Search again" — re-runs driver matching (5 km, then 10 km) for the rider's own ride while
 * it is still waiting for a driver. Nearby drivers get a fresh request notification.
 */
export const POST = withApi<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser(['rider']);
  const id = parseParam(uuidSchema, params.id, 'ride id');

  const db = createSupabaseAdminClient();
  const { data: ride, error } = await db.from('rides').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);
  if (!ride || ride.rider_id !== user.id) throw new ApiError(404, 'Ride not found');

  if (ride.status !== 'requested' && ride.status !== 'searching') {
    throw new ApiError(409, 'This ride is no longer looking for a driver.');
  }

  const result = await dispatchRide(ride);
  const body: CreateRideResult = {
    ride: result.ride,
    driversNotified: result.driversNotified,
    searchRadiusKm: result.searchRadiusKm,
  };
  return ok(body);
}, 'POST /api/rides/[id]/search');
