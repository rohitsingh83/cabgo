import { ApiError, ok, parseParam, requireApiUser, withApi } from '@/lib/api';
import { getDriverProfile } from '@/lib/drivers/service';
import { createNotification } from '@/lib/notifications';
import { publishRideClosed, publishRideEvent } from '@/lib/rides/realtime';
import { getRideWithRelations } from '@/lib/rides/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { uuidSchema } from '@/lib/validations';

/**
 * POST /api/rides/[id]/accept
 * First driver to accept wins: the `accept_ride` SQL function assigns the driver with a
 * conditional UPDATE, so concurrent accepts can never double-book a ride.
 */
export const POST = withApi<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser(['driver']);
  const id = parseParam(uuidSchema, params.id, 'ride id');

  const profile = await getDriverProfile(user.id);
  if (!profile) throw new ApiError(404, 'Complete your driver setup first.');
  if (!profile.is_verified) throw new ApiError(403, 'Your account is not verified yet.');
  if (!profile.is_online) throw new ApiError(409, 'Go online to accept rides.');

  const db = createSupabaseAdminClient();
  const { data: ride, error } = await db.rpc('accept_ride', { p_ride_id: id, p_driver_id: user.id });
  if (error) {
    // The SQL function raises these sentinel messages.
    if (error.message.includes('DRIVER_NOT_VERIFIED')) throw new ApiError(403, 'Your account is not verified yet.');
    if (error.message.includes('DRIVER_BUSY')) throw new ApiError(409, 'You already have a trip in progress.');
    if (error.message.includes('RIDE_UNAVAILABLE')) {
      throw new ApiError(409, 'Too late — this ride was taken or cancelled.');
    }
    throw new Error(`accept_ride failed: ${error.message}`);
  }
  if (!ride) throw new Error('accept_ride returned no ride');

  await createNotification({
    userId: ride.rider_id,
    type: 'ride_accepted',
    title: 'Driver found!',
    message: `${user.full_name} is on the way in a ${profile.vehicle_color} ${profile.vehicle_model} (${profile.vehicle_plate}).`,
    data: { rideId: ride.id, url: `/rider/tracking/${ride.id}` },
  });

  // Rider gets the live "driver found" push; every other online driver drops the request.
  await Promise.all([publishRideEvent(ride, 'ride:accepted'), publishRideClosed(ride.id, 'taken')]);

  const full = await getRideWithRelations(ride.id);
  if (!full) throw new ApiError(404, 'Ride not found');
  return ok(full);
}, 'POST /api/rides/[id]/accept');
