import 'server-only';

import { BUSINESS_RULES } from '@/lib/constants';
import { getRideWithRelations } from '@/lib/rides/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { haversineKm, roundTo, startOfDayInTimezone } from '@/lib/utils';
import type {
  DriverDayStats,
  DriverEarningsReport,
  DriverFeed,
  DriverPayoutItem,
  DriverProfile,
  DriverRideRequest,
  RideWithRelations,
  UserSummary,
} from '@/types';

export const BUSINESS_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Kolkata';

/** Requests older than this are considered abandoned and hidden from drivers. */
const REQUEST_MAX_AGE_MS = 20 * 60 * 1000;
const MAX_REQUESTS = 20;

/** Driver keeps this share of a fare. */
export function driverShare(fare: number): number {
  return roundTo((fare * (100 - BUSINESS_RULES.platformCommissionPercent)) / 100);
}

export async function getDriverProfile(userId: string): Promise<DriverProfile | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('driver_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load driver profile: ${error.message}`);
  return data;
}

/** The trip the driver is currently running (accepted → in progress), with rider + vehicle details. */
export async function getActiveRideForDriver(driverId: string): Promise<RideWithRelations | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('rides')
    .select('id')
    .eq('driver_id', driverId)
    .in('status', ['accepted', 'driver_arriving', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load active ride: ${error.message}`);
  return data ? getRideWithRelations(data.id) : null;
}

/**
 * Open requests this driver can accept: same vehicle type, unassigned, recent and within the
 * (expanded) matching radius of the driver's last known position.
 * A bounding-box query narrows rows in SQL; exact distance is computed with haversine.
 */
async function getOpenRequests(userId: string, profile: DriverProfile): Promise<DriverRideRequest[]> {
  if (!profile.is_online || !profile.is_verified || profile.current_lat === null || profile.current_lng === null) return [];

  const radiusKm = BUSINESS_RULES.matchingExpandedRadiusKm;
  const lat = profile.current_lat;
  const lng = profile.current_lng;
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('rides')
    .select('*')
    .is('driver_id', null)
    .in('status', ['requested', 'searching'])
    .eq('ride_type', profile.vehicle_type)
    .neq('rider_id', userId)
    .gte('created_at', new Date(Date.now() - REQUEST_MAX_AGE_MS).toISOString())
    .gte('pickup_lat', lat - dLat)
    .lte('pickup_lat', lat + dLat)
    .gte('pickup_lng', lng - dLng)
    .lte('pickup_lng', lng + dLng)
    .order('created_at', { ascending: false })
    .limit(MAX_REQUESTS);
  if (error) throw new Error(`Failed to load ride requests: ${error.message}`);

  const nearby = (data ?? [])
    .map((ride) => ({ ride, distance: haversineKm({ lat, lng }, { lat: ride.pickup_lat, lng: ride.pickup_lng }) }))
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
  if (nearby.length === 0) return [];

  const riderIds = Array.from(new Set(nearby.map((item) => item.ride.rider_id)));
  const { data: riders, error: ridersError } = await db.from('users').select('id, full_name, avatar_url').in('id', riderIds);
  if (ridersError) throw new Error(`Failed to load riders: ${ridersError.message}`);
  const byId = new Map<string, UserSummary>((riders ?? []).map((rider) => [rider.id, rider]));

  return nearby.map(({ ride, distance }) => ({
    ride,
    rider: byId.get(ride.rider_id) ?? null,
    pickupDistanceKm: roundTo(distance, 1),
    estimatedEarnings: driverShare(Number(ride.estimated_fare)),
  }));
}

export async function getDriverFeed(userId: string, profile: DriverProfile): Promise<DriverFeed> {
  const activeRide = await getActiveRideForDriver(userId);
  // A driver on a trip can't take another one — don't tease requests.
  const requests = activeRide ? [] : await getOpenRequests(userId, profile);
  return {
    profile,
    activeRide,
    requests,
    commissionPercent: BUSINESS_RULES.platformCommissionPercent,
    requestRadiusKm: BUSINESS_RULES.matchingExpandedRadiusKm,
  };
}

/** Completed trips whose payment has not settled, and what the driver will earn from them. */
async function getPendingPayouts(userId: string, since: Date): Promise<{ amount: number; rides: number }> {
  const db = createSupabaseAdminClient();
  const { data: rides, error } = await db
    .from('rides')
    .select('id, final_fare, estimated_fare')
    .eq('driver_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', since.toISOString())
    .limit(1000);
  if (error) throw new Error(`Failed to load completed rides: ${error.message}`);
  if (!rides || rides.length === 0) return { amount: 0, rides: 0 };

  const { data: payments, error: paymentsError } = await db
    .from('payments')
    .select('ride_id')
    .eq('driver_id', userId)
    .eq('status', 'completed')
    .in(
      'ride_id',
      rides.map((ride) => ride.id),
    );
  if (paymentsError) throw new Error(`Failed to load payments: ${paymentsError.message}`);

  const settled = new Set((payments ?? []).map((payment) => payment.ride_id));
  const unsettled = rides.filter((ride) => !settled.has(ride.id));
  return {
    amount: roundTo(unsettled.reduce((sum, ride) => sum + driverShare(Number(ride.final_fare ?? ride.estimated_fare)), 0)),
    rides: unsettled.length,
  };
}

/** "Today" tiles on the dashboard (day boundary = business timezone). */
export async function getDriverTodayStats(userId: string): Promise<DriverDayStats> {
  const db = createSupabaseAdminClient();
  const start = startOfDayInTimezone(BUSINESS_TIMEZONE);

  const [paymentsResult, pending, ridesResult] = await Promise.all([
    db
      .from('payments')
      .select('driver_earnings')
      .eq('driver_id', userId)
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .limit(1000),
    getPendingPayouts(userId, start),
    db
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', start.toISOString()),
  ]);
  if (paymentsResult.error) throw new Error(`Failed to load earnings: ${paymentsResult.error.message}`);
  if (ridesResult.error) throw new Error(`Failed to count rides: ${ridesResult.error.message}`);

  return {
    rides: ridesResult.count ?? 0,
    earnings: roundTo((paymentsResult.data ?? []).reduce((sum, row) => sum + Number(row.driver_earnings), 0)),
    pending: pending.amount,
  };
}

/** Everything the earnings page needs for a `days`-day window. */
export async function getDriverEarningsReport(userId: string, days: number): Promise<DriverEarningsReport> {
  const db = createSupabaseAdminClient();
  const since = new Date(startOfDayInTimezone(BUSINESS_TIMEZONE).getTime() - (days - 1) * 86_400_000);

  const [dailyResult, pending, recentResult] = await Promise.all([
    db.rpc('driver_earnings_summary', { p_driver_id: userId, p_days: days, p_tz: BUSINESS_TIMEZONE }),
    getPendingPayouts(userId, since),
    db
      .from('payments')
      .select('id, ride_id, driver_earnings, created_at')
      .eq('driver_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);
  if (dailyResult.error) throw new Error(`Failed to load earnings: ${dailyResult.error.message}`);
  if (recentResult.error) throw new Error(`Failed to load payouts: ${recentResult.error.message}`);

  const daily = (dailyResult.data ?? []).map((row) => ({
    day: row.day,
    rides_count: Number(row.rides_count),
    earnings: Number(row.earnings),
  }));

  const recentRows = recentResult.data ?? [];
  const rideIds = recentRows.map((row) => row.ride_id);
  const { data: rideRows, error: rideError } = rideIds.length
    ? await db.from('rides').select('id, pickup_address, dropoff_address').in('id', rideIds)
    : { data: [], error: null };
  if (rideError) throw new Error(`Failed to load payout rides: ${rideError.message}`);
  const rideById = new Map((rideRows ?? []).map((ride) => [ride.id, ride]));

  const recent: DriverPayoutItem[] = recentRows.map((row) => ({
    id: row.id,
    rideId: row.ride_id,
    amount: Number(row.driver_earnings),
    createdAt: row.created_at,
    pickupAddress: rideById.get(row.ride_id)?.pickup_address ?? null,
    dropoffAddress: rideById.get(row.ride_id)?.dropoff_address ?? null,
  }));

  return {
    days,
    daily,
    paid: roundTo(daily.reduce((sum, day) => sum + day.earnings, 0)),
    paidRides: daily.reduce((sum, day) => sum + day.rides_count, 0),
    pending: pending.amount,
    pendingRides: pending.rides,
    recent,
  };
}
