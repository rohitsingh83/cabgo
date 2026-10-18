import 'server-only';

import { loadUserBriefs, pageWindow, rangeStart, toPage, type UserBrief } from '@/lib/admin/common';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Paginated, Payment, Ride } from '@/types';

export interface AdminPaymentRow extends Payment {
  rider: UserBrief | null;
  driver: UserBrief | null;
  ride: Pick<Ride, 'id' | 'pickup_address' | 'dropoff_address' | 'created_at'> | null;
}

export interface AdminPaymentsQuery {
  page: number;
  status: 'all' | Payment['status'];
  range: '7d' | '30d' | '90d' | 'all';
}

export async function listAdminPayments(query: AdminPaymentsQuery): Promise<Paginated<AdminPaymentRow>> {
  const db = createSupabaseAdminClient();
  const { from, to } = pageWindow(query.page);

  let request = db.from('payments').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (query.status !== 'all') request = request.eq('status', query.status);
  const since = rangeStart(query.range);
  if (since) request = request.gte('created_at', since);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  const payments = data ?? [];

  const [briefs, rides] = await Promise.all([
    loadUserBriefs(payments.flatMap((payment) => [payment.rider_id, payment.driver_id])),
    payments.length
      ? db.from('rides').select('id, pickup_address, dropoff_address, created_at').in('id', [...new Set(payments.map((payment) => payment.ride_id))])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (rides.error) throw new Error(`Failed to load payment rides: ${rides.error.message}`);
  const rideById = new Map((rides.data ?? []).map((ride) => [ride.id, ride]));

  return toPage(
    payments.map((payment) => ({
      ...payment,
      rider: briefs.get(payment.rider_id) ?? null,
      driver: payment.driver_id ? briefs.get(payment.driver_id) ?? null : null,
      ride: rideById.get(payment.ride_id) ?? null,
    })),
    query.page,
    count,
  );
}

export interface PaymentTotals {
  gross: number;
  platformFees: number;
  driverEarnings: number;
  refunded: number;
  pendingCount: number;
  failedCount: number;
}

/** Money summary for the selected period (aggregated from up to 20 000 rows, newest first). */
export async function getPaymentTotals(range: AdminPaymentsQuery['range']): Promise<PaymentTotals> {
  const db = createSupabaseAdminClient();
  let request = db.from('payments').select('status, amount, platform_fee, driver_earnings').order('created_at', { ascending: false }).limit(20_000);
  const since = rangeStart(range);
  if (since) request = request.gte('created_at', since);
  const { data, error } = await request;
  if (error) throw new Error(`Failed to load payment totals: ${error.message}`);

  const totals: PaymentTotals = { gross: 0, platformFees: 0, driverEarnings: 0, refunded: 0, pendingCount: 0, failedCount: 0 };
  for (const row of data ?? []) {
    if (row.status === 'completed') {
      totals.gross += Number(row.amount);
      totals.platformFees += Number(row.platform_fee);
      totals.driverEarnings += Number(row.driver_earnings);
    } else if (row.status === 'refunded') totals.refunded += Number(row.amount);
    else if (row.status === 'pending') totals.pendingCount += 1;
    else if (row.status === 'failed') totals.failedCount += 1;
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return { ...totals, gross: round(totals.gross), platformFees: round(totals.platformFees), driverEarnings: round(totals.driverEarnings), refunded: round(totals.refunded) };
}
