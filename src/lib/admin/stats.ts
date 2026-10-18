import 'server-only';

import { BUSINESS_TIMEZONE } from '@/lib/drivers/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { loadUserBriefs, type UserBrief } from '@/lib/admin/common';
import type { AdminDailyStat, AdminOverview, Ride, RideStatus, SosAlert, VehicleType } from '@/types';

/** Headline numbers (one SQL round trip — see `admin_overview()` in migration 005). */
export async function getOverview(): Promise<AdminOverview> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc('admin_overview');
  if (error || !data) throw new Error(`admin_overview failed: ${error?.message ?? 'no data'}`);
  return data;
}

/** One row per day (zero-filled by the SQL function) for the revenue / rides chart. */
export async function getDailyStats(days: number): Promise<AdminDailyStat[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc('admin_daily_stats', { p_days: days, p_tz: BUSINESS_TIMEZONE });
  if (error) throw new Error(`admin_daily_stats failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    day: row.day,
    rides_count: Number(row.rides_count),
    completed_count: Number(row.completed_count),
    cancelled_count: Number(row.cancelled_count),
    revenue: Number(row.revenue),
  }));
}

const STATUSES: RideStatus[] = ['completed', 'cancelled', 'in_progress', 'driver_arriving', 'accepted', 'searching', 'requested'];
const VEHICLE_TYPES: VehicleType[] = ['bike', 'auto', 'sedan', 'suv'];

export interface BreakdownItem<K extends string> {
  key: K;
  count: number;
}

/** How rides created in the last `days` days ended up (head-only count queries: no rows are transferred). */
export async function getRideStatusBreakdown(days: number): Promise<BreakdownItem<RideStatus>[]> {
  const db = createSupabaseAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const results = await Promise.all(
    STATUSES.map(async (status) => {
      const { count, error } = await db.from('rides').select('id', { count: 'exact', head: true }).eq('status', status).gte('created_at', since);
      if (error) throw new Error(`Failed to count ${status} rides: ${error.message}`);
      return { key: status, count: count ?? 0 };
    }),
  );
  return results.filter((item) => item.count > 0);
}

/** Completed rides per vehicle class (demand mix). */
export async function getVehicleMix(days: number): Promise<BreakdownItem<VehicleType>[]> {
  const db = createSupabaseAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return Promise.all(
    VEHICLE_TYPES.map(async (type) => {
      const { count, error } = await db
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('ride_type', type)
        .eq('status', 'completed')
        .gte('created_at', since);
      if (error) throw new Error(`Failed to count ${type} rides: ${error.message}`);
      return { key: type, count: count ?? 0 };
    }),
  );
}

export interface TopDriver {
  driver: UserBrief | null;
  driverId: string;
  rides: number;
  earnings: number;
}

/** Highest-earning drivers in the period, aggregated in TypeScript from settled payments. */
export async function getTopDrivers(days: number, limit = 5): Promise<TopDriver[]> {
  const db = createSupabaseAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db
    .from('payments')
    .select('driver_id, driver_earnings')
    .eq('status', 'completed')
    .not('driver_id', 'is', null)
    .gte('created_at', since)
    .limit(10_000);
  if (error) throw new Error(`Failed to load driver earnings: ${error.message}`);

  const totals = new Map<string, { rides: number; earnings: number }>();
  for (const row of data ?? []) {
    if (!row.driver_id) continue;
    const entry = totals.get(row.driver_id) ?? { rides: 0, earnings: 0 };
    entry.rides += 1;
    entry.earnings += Number(row.driver_earnings);
    totals.set(row.driver_id, entry);
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1].earnings - a[1].earnings).slice(0, limit);
  const briefs = await loadUserBriefs(ranked.map(([id]) => id));
  return ranked.map(([driverId, value]) => ({ driverId, driver: briefs.get(driverId) ?? null, rides: value.rides, earnings: Math.round(value.earnings * 100) / 100 }));
}

export interface ActiveSosItem extends SosAlert {
  user: UserBrief | null;
}

/** Unresolved SOS alerts, newest first (shown as a banner on the overview). */
export async function getActiveSos(limit = 5): Promise<ActiveSosItem[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('sos_alerts').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`Failed to load SOS alerts: ${error.message}`);
  const briefs = await loadUserBriefs((data ?? []).map((alert) => alert.user_id));
  return (data ?? []).map((alert) => ({ ...alert, user: briefs.get(alert.user_id) ?? null }));
}

export type RecentRide = Pick<Ride, 'id' | 'status' | 'ride_type' | 'pickup_address' | 'dropoff_address' | 'estimated_fare' | 'final_fare' | 'created_at'> & {
  rider: UserBrief | null;
};

/** The latest rides on the platform for the activity feed. */
export async function getRecentRides(limit = 6): Promise<RecentRide[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('rides')
    .select('id, status, ride_type, pickup_address, dropoff_address, estimated_fare, final_fare, created_at, rider_id')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load recent rides: ${error.message}`);
  const briefs = await loadUserBriefs((data ?? []).map((ride) => ride.rider_id));
  return (data ?? []).map(({ rider_id, ...ride }) => ({ ...ride, rider: briefs.get(rider_id) ?? null }));
}
