import { ApiError, ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { getActiveRideForDriver, getDriverProfile } from '@/lib/drivers/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { driverLocationSchema } from '@/lib/validations';

/**
 * POST /api/driver/location  { lat, lng, heading? }
 * Persists the driver's last known position (used for matching and for restoring the live map
 * after a reconnect). The realtime channel streams positions to riders; this is the durable copy.
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['driver']);
  const input = await parseBody(request, driverLocationSchema);

  const profile = await getDriverProfile(user.id);
  if (!profile) throw new ApiError(404, 'Complete your driver setup first.');
  if (!profile.is_verified) throw new ApiError(403, 'Your account is not verified.');

  // Only drivers who are online or on a trip have a reason to share their position.
  if (!profile.is_online && !(await getActiveRideForDriver(user.id))) {
    throw new ApiError(409, 'You are offline.');
  }

  const db = createSupabaseAdminClient();
  const { error } = await db
    .from('driver_profiles')
    .update({
      current_lat: input.lat,
      current_lng: input.lng,
      current_heading: input.heading ?? null,
      last_location_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);
  if (error) throw new Error(`Failed to save location: ${error.message}`);

  return ok({ saved: true });
}, 'POST /api/driver/location');
