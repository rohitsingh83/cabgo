import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Paginated, RideHistoryItem } from '@/types';

export const HISTORY_PAGE_SIZE = 10;
const RANGE_DAYS = { '30d': 30, '90d': 90, '365d': 365 } as const;

export interface HistoryQuery {
  page: number;
  status: 'all' | 'completed' | 'cancelled';
  range: '30d' | '90d' | '365d' | 'all';
  q?: string;
}

/**
 * The rider's finished trips (completed + cancelled), newest first, with each trip's payment status and
 * the rating the rider gave — so the list can show "Pay now" / "Rate" nudges without N+1 requests.
 */
export async function listRiderHistory(riderId: string, query: HistoryQuery): Promise<Paginated<RideHistoryItem>> {
  const db = createSupabaseAdminClient();
  const from = (query.page - 1) * HISTORY_PAGE_SIZE;

  let request = db
    .from('rides')
    .select('*', { count: 'exact' })
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE - 1);

  request = query.status === 'all' ? request.in('status', ['completed', 'cancelled']) : request.eq('status', query.status);

  if (query.range !== 'all') {
    request = request.gte('created_at', new Date(Date.now() - RANGE_DAYS[query.range] * 86_400_000).toISOString());
  }
  // `q` was sanitised by historyQuerySchema (no PostgREST syntax characters can reach this string).
  if (query.q) request = request.or(`pickup_address.ilike.%${query.q}%,dropoff_address.ilike.%${query.q}%`);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load ride history: ${error.message}`);

  const rides = data ?? [];
  const ids = rides.map((ride) => ride.id);
  const [payments, ratings] = ids.length
    ? await Promise.all([
        db.from('payments').select('ride_id, status').in('ride_id', ids).neq('status', 'refunded'),
        db.from('ratings').select('ride_id, rating').eq('from_user_id', riderId).in('ride_id', ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (payments.error) throw new Error(`Failed to load history payments: ${payments.error.message}`);
  if (ratings.error) throw new Error(`Failed to load history ratings: ${ratings.error.message}`);

  const paymentByRide = new Map((payments.data ?? []).map((row) => [row.ride_id, row.status]));
  const ratingByRide = new Map((ratings.data ?? []).map((row) => [row.ride_id, row.rating]));

  const total = count ?? rides.length;
  return {
    items: rides.map((ride) => ({ ...ride, payment_status: paymentByRide.get(ride.id) ?? null, my_rating: ratingByRide.get(ride.id) ?? null })),
    page: query.page,
    pageSize: HISTORY_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
  };
}

export interface HistorySummary {
  completed: number;
  cancelled: number;
  distanceKm: number;
}

/** Lifetime totals for the history header tiles (capped at the latest 5 000 finished trips). */
export async function getRiderHistorySummary(riderId: string): Promise<HistorySummary> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('rides')
    .select('status, distance_km')
    .eq('rider_id', riderId)
    .in('status', ['completed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Failed to load history summary: ${error.message}`);

  const summary: HistorySummary = { completed: 0, cancelled: 0, distanceKm: 0 };
  for (const ride of data ?? []) {
    if (ride.status === 'completed') {
      summary.completed += 1;
      summary.distanceKm += Number(ride.distance_km);
    } else {
      summary.cancelled += 1;
    }
  }
  summary.distanceKm = Math.round(summary.distanceKm * 10) / 10;
  return summary;
}
