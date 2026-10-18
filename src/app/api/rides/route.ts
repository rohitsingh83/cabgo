import { ACTIVE_RIDE_STATUSES } from '@/lib/constants';
import { ApiError, ok, parseBody, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { getPaymentDues } from '@/lib/payments/service';
import { dispatchRide } from '@/lib/rides/matching';
import { quoteRide, sameAmount } from '@/lib/rides/pricing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateRideOtp } from '@/lib/rides/otp';
import { createRideSchema, ridesListQuerySchema } from '@/lib/validations';
import type { CreateRideResult, Paginated, RideListItem, RideStatus, UserSummary } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rides?page=&pageSize=&status=
 * The signed-in rider's (or driver's) rides, newest first, with the counterpart's profile.
 */
export const GET = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const { page, pageSize, status } = parseQuery(request, ridesListQuerySchema);

  const db = createSupabaseAdminClient();
  let query = db
    .from('rides')
    .select('*', { count: 'exact' })
    .eq(user.role === 'driver' ? 'driver_id' : 'rider_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status === 'active') query = query.in('status', [...ACTIVE_RIDE_STATUSES] as RideStatus[]);
  else if (status === 'completed' || status === 'cancelled') query = query.eq('status', status);

  const { data: rides, error, count } = await query;
  if (error) throw new Error(`Failed to list rides: ${error.message}`);

  const counterpartIds = Array.from(
    new Set((rides ?? []).flatMap((ride) => [ride.rider_id, ride.driver_id]).filter((id): id is string => Boolean(id))),
  );
  const { data: people, error: peopleError } = counterpartIds.length
    ? await db.from('users').select('id, full_name, avatar_url').in('id', counterpartIds)
    : { data: [] as UserSummary[], error: null };
  if (peopleError) throw new Error(`Failed to load ride participants: ${peopleError.message}`);

  const byId = new Map((people ?? []).map((person) => [person.id, person]));
  const items: RideListItem[] = (rides ?? []).map((ride) => ({
    ...ride,
    rider: byId.get(ride.rider_id) ?? null,
    driver: ride.driver_id ? byId.get(ride.driver_id) ?? null : null,
  }));

  const total = count ?? 0;
  const result: Paginated<RideListItem> = {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  return ok(result);
}, 'GET /api/rides');

/**
 * POST /api/rides — book a ride.
 *
 *  1. Re-resolve the route and re-price on the server (client numbers are never trusted).
 *  2. If the live price differs from what the rider saw (surge moved), answer 409 so the UI
 *     can show the new price and ask again.
 *  3. Insert the ride (the DB atomically redeems the promo code), then dispatch to drivers.
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider']);
  const input = await parseBody(request, createRideSchema);
  const db = createSupabaseAdminClient();

  // One live ride at a time.
  const { data: active, error: activeError } = await db
    .from('rides')
    .select('id')
    .eq('rider_id', user.id)
    .in('status', [...ACTIVE_RIDE_STATUSES] as RideStatus[])
    .limit(1)
    .maybeSingle();
  if (activeError) throw new Error(`Active ride check failed: ${activeError.message}`);
  if (active) {
    throw new ApiError(409, 'You already have a ride in progress.', { rideId: [active.id] });
  }

  // Unpaid trip (or unpaid late-cancellation fee) blocks new bookings until it is settled.
  const [due] = await getPaymentDues(user.id, 1);
  if (due) {
    throw new ApiError(
      402,
      `Please pay your outstanding ${formatCurrency(due.amount)} for a previous ride before booking again.`,
      { rideId: [due.rideId], payment: ['required'] },
    );
  }

  const quote = await quoteRide(
    { pickup: input.pickup, dropoff: input.dropoff, stops: input.stops, promoCode: input.promoCode },
    [input.rideType],
  );
  const estimate = quote.estimates[0];

  if (input.promoCode && !quote.promo?.valid) {
    throw new ApiError(400, quote.promo?.message ?? 'Promo code is not valid for this ride', {
      promoCode: [quote.promo?.message ?? 'Invalid promo code'],
    });
  }
  if (input.expectedTotal !== undefined && !sameAmount(input.expectedTotal, estimate.breakdown.total)) {
    throw new ApiError(
      409,
      `The fare changed to ${formatCurrency(estimate.breakdown.total)} because demand updated. Please review and confirm again.`,
    );
  }

  const rideOtp = generateRideOtp();
  const { data: ride, error } = await db
    .from('rides')
    .insert({
      rider_id: user.id,
      pickup_address: input.pickup.address,
      pickup_lat: input.pickup.lat,
      pickup_lng: input.pickup.lng,
      dropoff_address: input.dropoff.address,
      dropoff_lat: input.dropoff.lat,
      dropoff_lng: input.dropoff.lng,
      stops: input.stops,
      ride_type: input.rideType,
      status: 'requested',
      estimated_fare: estimate.breakdown.total,
      discount_amount: estimate.breakdown.discount,
      fare_breakdown: estimate.breakdown,
      distance_km: estimate.distanceKm,
      duration_minutes: estimate.durationMinutes,
      surge_multiplier: estimate.surgeMultiplier,
      promo_code_id: estimate.promo?.promoId ?? null,
      route_polyline: quote.route.polyline,
      otp: rideOtp,
    })
    .select('*')
    .single();

  if (error || !ride) {
    // 23514 = check violation raised by the promo redemption trigger (code used up meanwhile).
    if (error?.code === '23514') throw new ApiError(400, 'That promo code is no longer available.');
    throw new Error(`Failed to create ride: ${error?.message ?? 'no row returned'}`);
  }

  const dispatched = await dispatchRide(ride);
  const result: CreateRideResult = {
    ride: dispatched.ride,
    driversNotified: dispatched.driversNotified,
    searchRadiusKm: dispatched.searchRadiusKm,
  };
  return ok(result, 201);
}, 'POST /api/rides');
