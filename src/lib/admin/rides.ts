import 'server-only';

import { loadUserBriefs, pageWindow, rangeStart, toPage, type UserBrief } from '@/lib/admin/common';
import { ApiError } from '@/lib/api';
import { createNotification } from '@/lib/notifications';
import { publishRideClosed, publishRideEvent } from '@/lib/rides/realtime';
import { getRideWithRelations } from '@/lib/rides/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Paginated, Payment, Rating, Ride, RideWithRelations, SosAlert, SupportTicket, User } from '@/types';

export interface AdminRideRow extends Ride {
  rider: UserBrief | null;
  driver: UserBrief | null;
  payment_status: Payment['status'] | null;
}

export interface AdminRidesQuery {
  page: number;
  q?: string;
  status: 'all' | 'active' | Ride['status'];
  range: '7d' | '30d' | '90d' | 'all';
}

export async function listAdminRides(query: AdminRidesQuery): Promise<Paginated<AdminRideRow>> {
  const db = createSupabaseAdminClient();
  const { from, to } = pageWindow(query.page);

  let request = db.from('rides').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (query.status === 'active') request = request.in('status', ['requested', 'searching', 'accepted', 'driver_arriving', 'in_progress']);
  else if (query.status !== 'all') request = request.eq('status', query.status);

  const since = rangeStart(query.range);
  if (since) request = request.gte('created_at', since);
  if (query.q) request = request.or(`pickup_address.ilike.%${query.q}%,dropoff_address.ilike.%${query.q}%`);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load rides: ${error.message}`);
  const rides = data ?? [];

  const [briefs, payments] = await Promise.all([
    loadUserBriefs(rides.flatMap((ride) => [ride.rider_id, ride.driver_id])),
    rides.length
      ? db.from('payments').select('ride_id, status').in('ride_id', rides.map((ride) => ride.id)).neq('status', 'refunded')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (payments.error) throw new Error(`Failed to load ride payments: ${payments.error.message}`);
  const paymentByRide = new Map((payments.data ?? []).map((row) => [row.ride_id, row.status]));

  return toPage(
    rides.map((ride) => ({
      ...ride,
      rider: briefs.get(ride.rider_id) ?? null,
      driver: ride.driver_id ? briefs.get(ride.driver_id) ?? null : null,
      payment_status: paymentByRide.get(ride.id) ?? null,
    })),
    query.page,
    count,
  );
}

export interface AdminRideDetail {
  ride: RideWithRelations;
  rider: UserBrief | null;
  driver: UserBrief | null;
  payments: Payment[];
  ratings: Rating[];
  sosAlerts: SosAlert[];
  tickets: Pick<SupportTicket, 'id' | 'subject' | 'status' | 'category' | 'created_at'>[];
}

export async function getAdminRideDetail(rideId: string): Promise<AdminRideDetail | null> {
  const ride = await getRideWithRelations(rideId);
  if (!ride) return null;
  const db = createSupabaseAdminClient();

  const [briefs, payments, ratings, sos, tickets] = await Promise.all([
    loadUserBriefs([ride.rider_id, ride.driver_id]),
    db.from('payments').select('*').eq('ride_id', rideId).order('created_at', { ascending: false }),
    db.from('ratings').select('*').eq('ride_id', rideId),
    db.from('sos_alerts').select('*').eq('ride_id', rideId).order('created_at', { ascending: false }),
    db.from('support_tickets').select('id, subject, status, category, created_at').eq('ride_id', rideId).order('created_at', { ascending: false }),
  ]);
  for (const result of [payments, ratings, sos, tickets]) {
    if (result.error) throw new Error(`Failed to load ride details: ${result.error.message}`);
  }

  return {
    ride,
    rider: briefs.get(ride.rider_id) ?? null,
    driver: ride.driver_id ? briefs.get(ride.driver_id) ?? null : null,
    payments: payments.data ?? [],
    ratings: ratings.data ?? [],
    sosAlerts: sos.data ?? [],
    tickets: tickets.data ?? [],
  };
}

/**
 * Support-initiated cancellation of a live ride (stuck search, unreachable driver, safety escalation …).
 * No cancellation fee is charged — the rider did not choose this. Both parties are notified in-app and live.
 * The conditional update (`.eq('status', …)`) means a ride that moved on in the meantime is reported as a
 * conflict instead of being overwritten.
 */
export async function adminCancelRide(admin: Pick<User, 'id'>, rideId: string, reason: string): Promise<Ride> {
  const db = createSupabaseAdminClient();
  const { data: ride, error } = await db.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);
  if (!ride) throw new ApiError(404, 'Ride not found.');
  if (ride.status === 'completed' || ride.status === 'cancelled') {
    throw new ApiError(409, `This ride is already ${ride.status}.`);
  }

  const { data: updated, error: updateError } = await db
    .from('rides')
    .update({ status: 'cancelled', cancelled_by: admin.id, cancellation_reason: `Cancelled by CabGo support: ${reason}`, cancellation_fee: 0 })
    .eq('id', ride.id)
    .eq('status', ride.status)
    .select('*')
    .maybeSingle();
  if (updateError) throw new Error(`Failed to cancel ride: ${updateError.message}`);
  if (!updated) throw new ApiError(409, 'The ride status just changed. Refresh and try again.');

  const message = `CabGo support cancelled this ride: ${reason}`;
  await Promise.all([
    createNotification({ userId: updated.rider_id, type: 'ride_cancelled', title: 'Ride cancelled by support', message, data: { rideId: updated.id, url: `/rider/tracking/${updated.id}` } }),
    updated.driver_id
      ? createNotification({ userId: updated.driver_id, type: 'ride_cancelled', title: 'Ride cancelled by support', message, data: { rideId: updated.id, url: '/driver/rides' } })
      : Promise.resolve(null),
  ]);

  await publishRideEvent(updated, 'ride:cancelled');
  if (!updated.driver_id) await publishRideClosed(updated.id, 'expired');
  return updated;
}
