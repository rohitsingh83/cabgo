import { ApiError, ok, parseOptionalBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { createNotification } from '@/lib/notifications';
import { getCancellationPolicy } from '@/lib/rides/cancellation';
import { publishRideClosed, publishRideEvent } from '@/lib/rides/realtime';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { cancelRideSchema, uuidSchema } from '@/lib/validations';
import type { CancelRideResult } from '@/types';

/**
 * POST /api/rides/[id]/cancel  { reason? }
 *
 * Free while searching, and for 2 minutes after a driver accepts; afterwards a flat fee is
 * recorded on the ride (collected from the payments screen). In-progress trips can't be cancelled.
 */
export const POST = withApi<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser(['rider']);
  const id = parseParam(uuidSchema, params.id, 'ride id');
  const { reason } = await parseOptionalBody(request, cancelRideSchema);

  const db = createSupabaseAdminClient();
  const { data: ride, error } = await db.from('rides').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);
  if (!ride || ride.rider_id !== user.id) throw new ApiError(404, 'Ride not found');

  const policy = getCancellationPolicy(ride);
  if (!policy.canCancel) throw new ApiError(409, policy.blockedReason ?? 'This ride cannot be cancelled');

  // Conditional update: if the ride moved on (driver started the trip, etc.) between the read
  // above and this write, no row matches and we report a conflict instead of overwriting.
  const { data: updated, error: updateError } = await db
    .from('rides')
    .update({
      status: 'cancelled',
      cancelled_by: user.id,
      cancellation_reason: reason ?? 'Cancelled by rider',
      cancellation_fee: policy.fee,
    })
    .eq('id', ride.id)
    .eq('status', ride.status)
    .select('*')
    .maybeSingle();
  if (updateError) throw new Error(`Failed to cancel ride: ${updateError.message}`);
  if (!updated) throw new ApiError(409, 'The ride status just changed. Please refresh and try again.');

  if (updated.driver_id) {
    await createNotification({
      userId: updated.driver_id,
      type: 'ride_cancelled',
      title: 'Ride cancelled',
      message: `${user.full_name} cancelled the ride from ${updated.pickup_address}.`,
      data: { rideId: updated.id, url: '/driver/rides' },
    });
  }

  // Live updates: participants see the cancellation; drivers who were offered the ride drop it.
  await publishRideEvent(updated, 'ride:cancelled');
  if (!updated.driver_id) await publishRideClosed(updated.id, 'expired');

  const result: CancelRideResult = { ride: updated, cancellationFee: policy.fee, wasFree: policy.isFree };
  return ok(result);
}, 'POST /api/rides/[id]/cancel');
