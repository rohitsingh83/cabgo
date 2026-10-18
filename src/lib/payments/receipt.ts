import 'server-only';

import { VEHICLES } from '@/lib/constants';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Payment, ReceiptData } from '@/types';

/** `CG-202610-A1B2C3` — month of issue plus the first 6 hex chars of the payment id. */
export function receiptNumber(payment: Pick<Payment, 'id' | 'created_at'>): string {
  const d = new Date(payment.created_at);
  const month = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `CG-${month}-${payment.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/** Assemble a receipt from the payment row, its ride and the people involved. Returns null if missing. */
export async function getReceiptData(
  paymentId: string,
): Promise<{ receipt: ReceiptData; payment: Payment } | null> {
  const db = createSupabaseAdminClient();

  const { data: payment, error } = await db
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load payment: ${error.message}`);
  if (!payment) return null;

  const { data: ride, error: rideError } = await db
    .from('rides')
    .select('*')
    .eq('id', payment.ride_id)
    .maybeSingle();
  if (rideError) throw new Error(`Failed to load ride for receipt: ${rideError.message}`);
  if (!ride) return null;

  const userIds = [payment.rider_id, payment.driver_id].filter((id): id is string => Boolean(id));
  const [users, profile] = await Promise.all([
    db.from('users').select('id, full_name, email').in('id', userIds),
    payment.driver_id
      ? db
          .from('driver_profiles')
          .select('vehicle_model, vehicle_color, vehicle_plate')
          .eq('user_id', payment.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (users.error) throw new Error(`Failed to load receipt users: ${users.error.message}`);

  const rider = users.data?.find((u) => u.id === payment.rider_id);
  const driver = users.data?.find((u) => u.id === payment.driver_id);
  const vehicle = profile.data
    ? `${profile.data.vehicle_color} ${profile.data.vehicle_model} · ${profile.data.vehicle_plate}`
    : null;

  const stops = (ride.stops ?? []).map((stop) => stop.address);

  return {
    payment,
    receipt: {
      number: receiptNumber(payment),
      issuedAt: payment.updated_at,
      status: payment.status,
      method: payment.payment_method,
      kind: ride.status === 'cancelled' ? 'cancellation_fee' : 'fare',
      currency: payment.currency,
      total: Number(payment.amount),
      rider: { name: rider?.full_name ?? 'Rider', email: rider?.email ?? null },
      driver: driver ? { name: driver.full_name, vehicle } : null,
      ride: {
        id: ride.id,
        date: ride.created_at,
        pickup: ride.pickup_address,
        dropoff: ride.dropoff_address,
        stops,
        distanceKm: Number(ride.distance_km),
        durationMinutes: Number(ride.duration_minutes),
        vehicleLabel: VEHICLES[ride.ride_type].label,
      },
      breakdown: ride.status === 'cancelled' ? null : ride.fare_breakdown,
      stripeReceiptUrl: payment.receipt_url,
    },
  };
}
