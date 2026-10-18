import 'server-only';

import { ADMIN_PAGE_SIZE, pageWindow, toPage } from '@/lib/admin/common';
import { ApiError } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DriverProfile, Paginated, Payment, Ride, SupportTicket, User } from '@/types';

export interface AdminUsersQuery {
  page: number;
  q?: string;
  role: 'all' | User['role'];
  status: 'all' | 'active' | 'suspended';
}

export async function listUsers(query: AdminUsersQuery): Promise<Paginated<User>> {
  const db = createSupabaseAdminClient();
  const { from, to } = pageWindow(query.page);

  let request = db.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (query.role !== 'all') request = request.eq('role', query.role);
  if (query.status !== 'all') request = request.eq('is_active', query.status === 'active');
  // `q` was sanitised by adminUsersQuerySchema, so it cannot inject PostgREST filter syntax.
  if (query.q) request = request.or(`full_name.ilike.%${query.q}%,email.ilike.%${query.q}%,phone.ilike.%${query.q}%`);

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  return toPage(data ?? [], query.page, count);
}

export interface AdminUserDetail {
  user: User;
  driverProfile: DriverProfile | null;
  stats: {
    ridesAsRider: number;
    ridesAsDriver: number;
    totalSpent: number;
    totalEarned: number;
    tickets: number;
    sosAlerts: number;
  };
  recentRides: Pick<Ride, 'id' | 'status' | 'pickup_address' | 'dropoff_address' | 'created_at' | 'rider_id' | 'driver_id' | 'estimated_fare' | 'final_fare'>[];
  recentTickets: Pick<SupportTicket, 'id' | 'subject' | 'status' | 'category' | 'created_at'>[];
}

async function count(table: 'rides' | 'support_tickets' | 'sos_alerts', column: string, value: string): Promise<number> {
  const db = createSupabaseAdminClient();
  const { count: total, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq(column, value);
  if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
  return total ?? 0;
}

const sum = (rows: Pick<Payment, 'amount'>[] | { driver_earnings: number }[], key: 'amount' | 'driver_earnings') =>
  Math.round(rows.reduce((total, row) => total + Number((row as Record<string, number>)[key] ?? 0), 0) * 100) / 100;

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const db = createSupabaseAdminClient();
  const { data: user, error } = await db.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load user: ${error.message}`);
  if (!user) return null;

  const [profile, ridesAsRider, ridesAsDriver, tickets, sosAlerts, spent, earned, rides, recentTickets] = await Promise.all([
    db.from('driver_profiles').select('*').eq('user_id', userId).maybeSingle(),
    count('rides', 'rider_id', userId),
    count('rides', 'driver_id', userId),
    count('support_tickets', 'user_id', userId),
    count('sos_alerts', 'user_id', userId),
    db.from('payments').select('amount').eq('rider_id', userId).eq('status', 'completed').limit(5000),
    db.from('payments').select('driver_earnings').eq('driver_id', userId).eq('status', 'completed').limit(5000),
    db
      .from('rides')
      .select('id, status, pickup_address, dropoff_address, created_at, rider_id, driver_id, estimated_fare, final_fare')
      .or(`rider_id.eq.${userId},driver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(6),
    db.from('support_tickets').select('id, subject, status, category, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
  ]);

  for (const result of [profile, spent, earned, rides, recentTickets]) {
    if (result.error) throw new Error(`Failed to load user activity: ${result.error.message}`);
  }

  return {
    user,
    driverProfile: profile.data ?? null,
    stats: {
      ridesAsRider,
      ridesAsDriver,
      totalSpent: sum(spent.data ?? [], 'amount'),
      totalEarned: sum(earned.data ?? [], 'driver_earnings'),
      tickets,
      sosAlerts,
    },
    recentRides: rides.data ?? [],
    recentTickets: recentTickets.data ?? [],
  };
}

/**
 * Suspend or reinstate an account.
 *
 *  - You cannot suspend yourself, and admin accounts are never suspended here (no lock-out path).
 *  - An account in the middle of a trip cannot be suspended — finish or cancel the ride first.
 *  - Suspending a rider cancels their still-unmatched requests; suspending a driver takes them offline.
 *  - `is_active = false` is enforced on every request (getCurrentUser / requireApiUser), so the
 *    effect is immediate even for already-signed-in sessions.
 */
export async function setUserActive(admin: Pick<User, 'id'>, targetId: string, isActive: boolean, reason?: string): Promise<User> {
  const db = createSupabaseAdminClient();
  const { data: target, error } = await db.from('users').select('*').eq('id', targetId).maybeSingle();
  if (error) throw new Error(`Failed to load user: ${error.message}`);
  if (!target) throw new ApiError(404, 'User not found.');
  if (target.id === admin.id) throw new ApiError(400, 'You cannot suspend your own account.');
  if (target.role === 'admin') throw new ApiError(403, 'Administrator accounts cannot be suspended from here.');
  if (target.is_active === isActive) return target;

  if (!isActive) {
    const { data: busy, error: busyError } = await db
      .from('rides')
      .select('id')
      .or(`rider_id.eq.${targetId},driver_id.eq.${targetId}`)
      .in('status', ['accepted', 'driver_arriving', 'in_progress'])
      .limit(1);
    if (busyError) throw new Error(`Failed to check active rides: ${busyError.message}`);
    if ((busy ?? []).length > 0) {
      throw new ApiError(409, 'This user has a ride in progress. Wait for it to finish or cancel the ride first.', { rideId: [busy![0]!.id] });
    }

    // Unmatched requests would otherwise keep searching for drivers on behalf of a suspended rider.
    const { error: cancelError } = await db
      .from('rides')
      .update({ status: 'cancelled', cancelled_by: admin.id, cancellation_reason: 'Account suspended', cancellation_fee: 0 })
      .eq('rider_id', targetId)
      .in('status', ['requested', 'searching']);
    if (cancelError) throw new Error(`Failed to cancel pending rides: ${cancelError.message}`);

    if (target.role === 'driver') {
      const { error: offlineError } = await db.from('driver_profiles').update({ is_online: false }).eq('user_id', targetId);
      if (offlineError) throw new Error(`Failed to take driver offline: ${offlineError.message}`);
    }
  }

  const { data: updated, error: updateError } = await db.from('users').update({ is_active: isActive }).eq('id', targetId).select('*').single();
  if (updateError || !updated) throw new Error(`Failed to update user: ${updateError?.message ?? 'no row returned'}`);

  console.info(`[admin] ${admin.id} ${isActive ? 'reinstated' : 'suspended'} user ${targetId}${reason ? ` — ${reason}` : ''}`);
  return updated;
}

export { ADMIN_PAGE_SIZE };
