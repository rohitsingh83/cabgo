import 'server-only';

import { loadUserBriefs, pageWindow, toPage, type UserBrief } from '@/lib/admin/common';
import { ApiError } from '@/lib/api';
import { createNotification } from '@/lib/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Paginated, Ride, SosAlert, User } from '@/types';

export interface AdminSosRow extends SosAlert {
  user: UserBrief | null;
  ride: Pick<Ride, 'id' | 'status' | 'pickup_address' | 'dropoff_address' | 'rider_id' | 'driver_id'> | null;
  /** The other person on the trip (rider ↔ driver), for quick follow-up calls. */
  counterpart: UserBrief | null;
  resolver: UserBrief | null;
}

export async function listSosAlerts(query: { page: number; status: 'all' | SosAlert['status'] }): Promise<Paginated<AdminSosRow>> {
  const db = createSupabaseAdminClient();
  const { from, to } = pageWindow(query.page);

  let request = db
    .from('sos_alerts')
    .select('*', { count: 'exact' })
    // Active alerts: oldest first (longest waiting on top). History: newest first.
    .order('created_at', { ascending: query.status === 'active' })
    .range(from, to);
  if (query.status !== 'all') request = request.eq('status', query.status);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load SOS alerts: ${error.message}`);
  const alerts = data ?? [];

  const rides = alerts.length
    ? await db.from('rides').select('id, status, pickup_address, dropoff_address, rider_id, driver_id').in('id', [...new Set(alerts.map((alert) => alert.ride_id))])
    : { data: [], error: null };
  if (rides.error) throw new Error(`Failed to load SOS rides: ${rides.error.message}`);
  const rideById = new Map((rides.data ?? []).map((ride) => [ride.id, ride]));

  const briefs = await loadUserBriefs(
    alerts.flatMap((alert) => {
      const ride = rideById.get(alert.ride_id);
      return [alert.user_id, alert.resolved_by, ride?.rider_id, ride?.driver_id];
    }),
  );

  return toPage(
    alerts.map((alert) => {
      const ride = rideById.get(alert.ride_id) ?? null;
      const otherId = ride ? (ride.rider_id === alert.user_id ? ride.driver_id : ride.rider_id) : null;
      return {
        ...alert,
        user: briefs.get(alert.user_id) ?? null,
        ride,
        counterpart: otherId ? briefs.get(otherId) ?? null : null,
        resolver: alert.resolved_by ? briefs.get(alert.resolved_by) ?? null : null,
      };
    }),
    query.page,
    count,
  );
}

/** An admin closes an alert after following up with the user. The user is told it was handled. */
export async function resolveSosAsAdmin(admin: Pick<User, 'id'>, alertId: string): Promise<SosAlert> {
  const db = createSupabaseAdminClient();
  const { data: alert, error } = await db.from('sos_alerts').select('*').eq('id', alertId).maybeSingle();
  if (error) throw new Error(`Failed to load SOS alert: ${error.message}`);
  if (!alert) throw new ApiError(404, 'SOS alert not found.');
  if (alert.status === 'resolved') return alert;

  const { data: updated, error: updateError } = await db
    .from('sos_alerts')
    .update({ status: 'resolved', resolved_by: admin.id })
    .eq('id', alertId)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();
  if (updateError) throw new Error(`Failed to resolve SOS alert: ${updateError.message}`);
  // Someone else (or the user themselves) resolved it a moment ago — that is the outcome we wanted anyway.
  if (!updated) return { ...alert, status: 'resolved' };

  await createNotification({
    userId: alert.user_id,
    type: 'sos',
    title: 'Your SOS alert was closed',
    message: 'Our safety team has marked your alert as handled. Contact support if you still need help.',
    data: { rideId: alert.ride_id, url: '/rider/support' },
  });
  return updated;
}
