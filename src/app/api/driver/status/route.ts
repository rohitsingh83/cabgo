import { ApiError, ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { getActiveRideForDriver, getDriverProfile } from '@/lib/drivers/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { driverStatusSchema } from '@/lib/validations';
import type { DriverProfile } from '@/types';

/**
 * POST /api/driver/status  { online, lat?, lng?, heading? }
 * Go online (needs a verified account and a position) or offline (not during a trip).
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['driver']);
  const input = await parseBody(request, driverStatusSchema);

  const profile = await getDriverProfile(user.id);
  if (!profile) throw new ApiError(404, 'Complete your driver setup first.');

  if (input.online && !profile.is_verified) {
    throw new ApiError(
      403,
      profile.verification_status === 'rejected'
        ? 'Your documents were rejected. Update your profile and resubmit.'
        : 'Your account is still being verified. You can go online once an admin approves it.',
    );
  }
  if (!input.online && (await getActiveRideForDriver(user.id))) {
    throw new ApiError(409, 'Finish your current trip before going offline.');
  }

  const db = createSupabaseAdminClient();
  const update: Partial<Pick<DriverProfile, 'is_online' | 'current_lat' | 'current_lng' | 'current_heading' | 'last_location_at'>> = {
    is_online: input.online,
  };
  if (input.online && input.lat !== undefined && input.lng !== undefined) {
    update.current_lat = input.lat;
    update.current_lng = input.lng;
    update.current_heading = input.heading ?? null;
    // Always refresh — the DB trigger only does it when the coordinates change.
    update.last_location_at = new Date().toISOString();
  }

  const { data, error } = await db.from('driver_profiles').update(update).eq('user_id', user.id).select('*').single();
  if (error || !data) throw new Error(`Failed to update driver status: ${error?.message ?? 'no row returned'}`);
  return ok<DriverProfile>(data);
}, 'POST /api/driver/status');
