import 'server-only';

import { pageWindow, toPage, loadUserBriefs, type UserBrief } from '@/lib/admin/common';
import { ApiError } from '@/lib/api';
import { STORAGE_BUCKETS } from '@/lib/constants';
import { createNotification } from '@/lib/notifications';
import { getRatingSummary } from '@/lib/ratings/service';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DriverProfile, Paginated, Ride, RatingSummary, User } from '@/types';

export interface AdminDriverRow extends DriverProfile {
  user: UserBrief | null;
}

export interface AdminDriversQuery {
  page: number;
  q?: string;
  status: 'all' | DriverProfile['verification_status'];
}

export async function listDrivers(query: AdminDriversQuery): Promise<Paginated<AdminDriverRow>> {
  const db = createSupabaseAdminClient();
  const { from, to } = pageWindow(query.page);

  let request = db
    .from('driver_profiles')
    .select('*', { count: 'exact' })
    // The verification queue is worked oldest-first so nobody waits indefinitely.
    .order('created_at', { ascending: query.status === 'pending' })
    .range(from, to);
  if (query.status !== 'all') request = request.eq('verification_status', query.status);

  if (query.q) {
    // Match the person (name / email / phone) or the vehicle (plate / licence number).
    const { data: people, error: peopleError } = await db
      .from('users')
      .select('id')
      .eq('role', 'driver')
      .or(`full_name.ilike.%${query.q}%,email.ilike.%${query.q}%,phone.ilike.%${query.q}%`)
      .limit(200);
    if (peopleError) throw new Error(`Failed to search drivers: ${peopleError.message}`);
    const ids = (people ?? []).map((person) => person.id);
    const clauses = [`vehicle_plate.ilike.%${query.q}%`, `license_number.ilike.%${query.q}%`];
    if (ids.length > 0) clauses.push(`user_id.in.(${ids.join(',')})`);
    request = request.or(clauses.join(','));
  }

  const { data, error, count } = await request;
  if (error) throw new Error(`Failed to load drivers: ${error.message}`);

  const briefs = await loadUserBriefs((data ?? []).map((profile) => profile.user_id));
  return toPage((data ?? []).map((profile) => ({ ...profile, user: briefs.get(profile.user_id) ?? null })), query.page, count);
}

export interface AdminDriverDetail {
  profile: DriverProfile;
  user: User;
  documents: { license: string | null; vehicle: string | null };
  ratings: RatingSummary;
  totalEarned: number;
  recentRides: Pick<Ride, 'id' | 'status' | 'pickup_address' | 'dropoff_address' | 'created_at' | 'estimated_fare' | 'final_fare'>[];
}

/** Private documents are shown through 1-hour signed links. */
async function signed(path: string | null): Promise<string | null> {
  if (!path) return null;
  const db = createSupabaseAdminClient();
  const { data, error } = await db.storage.from(STORAGE_BUCKETS.driverDocuments).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

/** `userId` is the driver's users.id (the URL parameter of /admin/drivers/[id]). */
export async function getDriverDetail(userId: string): Promise<AdminDriverDetail | null> {
  const db = createSupabaseAdminClient();
  const [profileResult, userResult] = await Promise.all([
    db.from('driver_profiles').select('*').eq('user_id', userId).maybeSingle(),
    db.from('users').select('*').eq('id', userId).maybeSingle(),
  ]);
  if (profileResult.error) throw new Error(`Failed to load driver profile: ${profileResult.error.message}`);
  if (userResult.error) throw new Error(`Failed to load driver: ${userResult.error.message}`);
  const profile = profileResult.data;
  const user = userResult.data;
  if (!profile || !user) return null;

  const [license, vehicle, ratings, earned, rides] = await Promise.all([
    signed(profile.license_document_url),
    signed(profile.vehicle_document_url),
    getRatingSummary(userId),
    db.from('payments').select('driver_earnings').eq('driver_id', userId).eq('status', 'completed').limit(5000),
    db
      .from('rides')
      .select('id, status, pickup_address, dropoff_address, created_at, estimated_fare, final_fare')
      .eq('driver_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);
  if (earned.error) throw new Error(`Failed to load earnings: ${earned.error.message}`);
  if (rides.error) throw new Error(`Failed to load rides: ${rides.error.message}`);

  return {
    profile,
    user,
    documents: { license, vehicle },
    ratings,
    totalEarned: Math.round((earned.data ?? []).reduce((total, row) => total + Number(row.driver_earnings), 0) * 100) / 100,
    recentRides: rides.data ?? [],
  };
}

type ReviewInput = { action: 'approve' } | { action: 'reject'; reason: string };

/**
 * Approve or reject a driver application.
 *
 * Approval needs both documents on file. Rejecting an already-approved driver revokes their access
 * (the DB trigger forces `is_online = false` for unverified drivers, so they drop off the map).
 * The driver is told the outcome — with the reason, so they know exactly what to fix.
 */
export async function reviewDriver(admin: Pick<User, 'id'>, driverUserId: string, input: ReviewInput): Promise<DriverProfile> {
  const db = createSupabaseAdminClient();
  const { data: profile, error } = await db.from('driver_profiles').select('*').eq('user_id', driverUserId).maybeSingle();
  if (error) throw new Error(`Failed to load driver profile: ${error.message}`);
  if (!profile) throw new ApiError(404, 'Driver profile not found.');

  if (input.action === 'approve') {
    if (profile.verification_status === 'approved') return profile;
    if (!profile.license_document_url || !profile.vehicle_document_url) {
      throw new ApiError(409, 'Both the licence and vehicle documents must be uploaded before approval.');
    }
  }

  const changes =
    input.action === 'approve'
      ? { verification_status: 'approved' as const, is_verified: true, verified_at: new Date().toISOString(), verified_by: admin.id, rejection_reason: null }
      : { verification_status: 'rejected' as const, is_verified: false, verified_at: null, verified_by: admin.id, rejection_reason: input.reason, is_online: false };

  const { data: updated, error: updateError } = await db.from('driver_profiles').update(changes).eq('user_id', driverUserId).select('*').single();
  if (updateError || !updated) throw new Error(`Failed to update driver: ${updateError?.message ?? 'no row returned'}`);

  await createNotification(
    input.action === 'approve'
      ? { userId: driverUserId, type: 'driver_verified', title: "You're verified 🎉", message: 'Your documents were approved. Go online to start receiving ride requests.', data: { url: '/driver' } }
      : { userId: driverUserId, type: 'driver_rejected', title: 'Verification needs attention', message: input.reason.slice(0, 200), data: { url: '/driver/profile' } },
  );

  return updated;
}
