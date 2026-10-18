import { ApiError, ok, parseBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { createNotification } from '@/lib/notifications';
import { publishRideEvent } from '@/lib/rides/realtime';
import { getRideWithRelations } from '@/lib/rides/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatCurrency } from '@/lib/utils';
import { verifyRideOtp } from '@/lib/rides/otp';
import { driverRideActionSchema, uuidSchema } from '@/lib/validations';
import type { Ride, RideStatus } from '@/types';

/**
 * POST /api/rides/[id]/status  { action: 'arrived' | 'start' | 'complete' | 'cancel', reason? }
 *
 * The driver's side of the ride state machine:
 *   accepted ──arrived──▶ driver_arriving ──start──▶ in_progress ──complete──▶ completed
 *   accepted / driver_arriving ──cancel──▶ cancelled   (no fee for the rider)
 * The DB trigger validates every transition again, so this can't be bypassed.
 */
export const POST = withApi<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser(['driver']);
  const id = parseParam(uuidSchema, params.id, 'ride id');
  const input = await parseBody(request, driverRideActionSchema);

  const db = createSupabaseAdminClient();
  const { data: ride, error } = await db.from('rides').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);
  if (!ride || ride.driver_id !== user.id) throw new ApiError(404, 'Ride not found');

  let from: RideStatus;
  let update: Partial<Pick<Ride, 'status' | 'final_fare' | 'cancelled_by' | 'cancellation_reason' | 'cancellation_fee'>>;
  let notification: { type: 'driver_arriving' | 'ride_started' | 'ride_completed' | 'ride_cancelled'; title: string; message: string };

  switch (input.action) {
    case 'arrived':
      if (ride.status !== 'accepted') throw new ApiError(409, 'You have already marked this pickup as reached.');
      from = 'accepted';
      update = { status: 'driver_arriving' };
      notification = { type: 'driver_arriving', title: 'Your driver has arrived', message: 'Head to your pickup point — your driver is waiting.' };
      break;

    case 'start':
      if (ride.status === 'accepted') throw new ApiError(409, 'Tap "I\'ve arrived" before starting the trip.');
      if (ride.status !== 'driver_arriving') throw new ApiError(409, 'This trip cannot be started.');
      if (!input.otp || !verifyRideOtp(ride, input.otp)) {
        throw new ApiError(400, 'Invalid Ride OTP. Please ask the passenger for the 4-digit PIN displayed on their screen.');
      }
      from = 'driver_arriving';
      update = { status: 'in_progress' };
      notification = { type: 'ride_started', title: 'Trip started', message: `Heading to ${ride.dropoff_address}.` };
      break;

    case 'complete':
      if (ride.status !== 'in_progress') throw new ApiError(409, 'Only a trip in progress can be completed.');
      from = 'in_progress';
      // The fare was locked when the rider booked, so the final fare equals the quoted fare.
      update = { status: 'completed', final_fare: ride.estimated_fare };
      notification = {
        type: 'ride_completed',
        title: 'You have arrived',
        message: `Trip complete. Your fare is ${formatCurrency(Number(ride.estimated_fare))}.`,
      };
      break;

    case 'cancel':
      if (ride.status === 'in_progress') throw new ApiError(409, 'A trip in progress cannot be cancelled. Complete it or contact support.');
      if (ride.status !== 'accepted' && ride.status !== 'driver_arriving') throw new ApiError(409, 'This ride can no longer be cancelled.');
      from = ride.status;
      // Drivers never cost the rider a fee.
      update = {
        status: 'cancelled',
        cancelled_by: user.id,
        cancellation_reason: input.reason ? `Driver: ${input.reason}` : 'Cancelled by driver',
        cancellation_fee: 0,
      };
      notification = {
        type: 'ride_cancelled',
        title: 'Your driver cancelled',
        message: 'Sorry about that — book again and we will find you another driver. You were not charged.',
      };
      break;
  }

  // Conditional update: if the rider cancelled in the meantime, no row matches.
  const { data: updated, error: updateError } = await db
    .from('rides')
    .update(update)
    .eq('id', ride.id)
    .eq('driver_id', user.id)
    .eq('status', from)
    .select('*')
    .maybeSingle();
  if (updateError) throw new Error(`Failed to update ride: ${updateError.message}`);
  if (!updated) throw new ApiError(409, 'The ride changed while you were updating it. Please refresh.');

  await createNotification({
    userId: ride.rider_id,
    ...notification,
    data: { rideId: ride.id, url: `/rider/tracking/${ride.id}` },
  });

  await publishRideEvent(updated, updated.status === 'cancelled' ? 'ride:cancelled' : 'ride:status');

  const full = await getRideWithRelations(ride.id);
  if (!full) throw new ApiError(404, 'Ride not found');
  return ok(full);
}, 'POST /api/rides/[id]/status');
