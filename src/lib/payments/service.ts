import 'server-only';

import { payableFor } from '@/lib/payments/payable';
import { driverShare } from '@/lib/drivers/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { roundTo, startOfDayInTimezone } from '@/lib/utils';
import type {
  Paginated,
  Payment,
  PaymentDue,
  PaymentKind,
  PaymentListItem,
  PaymentSummary,
  User,
} from '@/types';

export const PAYMENTS_PAGE_SIZE = 10;

export { payableFor };

/** Platform/driver split stored on every payment row (driver earnings feed the driver dashboard). */
export function splitPayment(
  amount: number,
  hasDriver: boolean,
): { platform_fee: number; driver_earnings: number } {
  if (!hasDriver) return { platform_fee: amount, driver_earnings: 0 };
  const driver = driverShare(amount);
  return { platform_fee: roundTo(amount - driver), driver_earnings: driver };
}

/** Rides the rider has not settled yet (newest first). `refunded` counts as settled. */
export async function getPaymentDues(riderId: string, limit = 10): Promise<PaymentDue[]> {
  const db = createSupabaseAdminClient();

  const { data: rides, error } = await db
    .from('rides')
    .select('id, status, final_fare, estimated_fare, cancellation_fee, dropoff_address, created_at')
    .eq('rider_id', riderId)
    .in('status', ['completed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`Failed to load rides for dues: ${error.message}`);

  const candidates = (rides ?? []).filter((ride) => payableFor(ride) !== null);
  if (candidates.length === 0) return [];

  const { data: payments, error: paymentsError } = await db
    .from('payments')
    .select('ride_id, status')
    .in(
      'ride_id',
      candidates.map((ride) => ride.id),
    )
    .in('status', ['completed', 'refunded']);
  if (paymentsError) throw new Error(`Failed to load payments for dues: ${paymentsError.message}`);

  const settled = new Set((payments ?? []).map((payment) => payment.ride_id));
  return candidates
    .filter((ride) => !settled.has(ride.id))
    .slice(0, limit)
    .map((ride) => {
      const payable = payableFor(ride) as { amount: number; kind: PaymentKind };
      return {
        rideId: ride.id,
        amount: payable.amount,
        kind: payable.kind,
        dropoffAddress: ride.dropoff_address,
        createdAt: ride.created_at,
      };
    });
}

export async function getPaymentSummary(
  riderId: string,
  dues?: PaymentDue[],
): Promise<PaymentSummary> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('payments')
    .select('amount, created_at')
    .eq('rider_id', riderId)
    .eq('status', 'completed')
    .limit(5000);
  if (error) throw new Error(`Failed to load payment summary: ${error.message}`);

  const monthStart = new Date(
    startOfDayInTimezone(process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Kolkata'),
  );
  monthStart.setUTCDate(1);
  const rows = data ?? [];
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const paidThisMonth = rows
    .filter((row) => new Date(row.created_at) >= monthStart)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const outstanding = dues ?? (await getPaymentDues(riderId, 50));

  return {
    totalPaid: roundTo(totalPaid),
    paidThisMonth: roundTo(paidThisMonth),
    paymentCount: rows.length,
    dueTotal: roundTo(outstanding.reduce((sum, due) => sum + due.amount, 0)),
  };
}

/** Paginated payment history. Riders see what they paid, drivers what they earned, admins everything. */
export async function listPayments(
  user: Pick<User, 'id' | 'role'>,
  query: { page: number; status: 'all' | Payment['status'] },
): Promise<Paginated<PaymentListItem>> {
  const db = createSupabaseAdminClient();
  const from = (query.page - 1) * PAYMENTS_PAGE_SIZE;

  let request = db
    .from('payments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAYMENTS_PAGE_SIZE - 1);

  if (user.role === 'rider') request = request.eq('rider_id', user.id);
  else if (user.role === 'driver') request = request.eq('driver_id', user.id);
  if (query.status !== 'all') request = request.eq('status', query.status);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load payments: ${error.message}`);

  const payments = data ?? [];
  const rideIds = [...new Set(payments.map((payment) => payment.ride_id))];
  const rides = rideIds.length
    ? await db
        .from('rides')
        .select('id, pickup_address, dropoff_address, created_at, ride_type, status')
        .in('id', rideIds)
    : { data: [], error: null };
  if (rides.error) throw new Error(`Failed to load payment rides: ${rides.error.message}`);

  const byId = new Map((rides.data ?? []).map((ride) => [ride.id, ride]));
  const total = count ?? payments.length;
  return {
    items: payments.map((payment) => ({ ...payment, ride: byId.get(payment.ride_id) ?? null })),
    page: query.page,
    pageSize: PAYMENTS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE)),
  };
}
