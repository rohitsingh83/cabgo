import 'server-only';

import { ApiError } from '@/lib/api';
import { allowedTags, type RatingTarget } from '@/lib/feedback';
import { createNotification } from '@/lib/notifications';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { DriverPublicProfile, Rating, RatingSummary, ReviewItem, User } from '@/types';

/** Ratings can be left for a week after the trip ends (same window as the big ride-hailing apps). */
export const RATING_WINDOW_DAYS = 7;

interface SubmitRatingInput {
  rideId: string;
  rating: number;
  reviewText?: string;
  tags: string[];
}

/**
 * Rider → driver or driver → rider. The direction is derived from who the caller is on this ride,
 * never from the request, so nobody can rate on behalf of someone else or rate a stranger.
 * The DB trigger re-checks participants + "completed only", and `unique (ride_id, from_user_id)`
 * guarantees one rating per person per ride even under concurrent submits.
 */
export async function submitRating(user: Pick<User, 'id' | 'full_name'>, input: SubmitRatingInput): Promise<Rating> {
  const db = createSupabaseAdminClient();

  const { data: ride, error } = await db.from('rides').select('id, rider_id, driver_id, status, completed_at, updated_at').eq('id', input.rideId).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);

  const isRider = ride?.rider_id === user.id;
  const isDriver = ride?.driver_id === user.id;
  // 404 for strangers so ride ids cannot be probed.
  if (!ride || (!isRider && !isDriver)) throw new ApiError(404, 'Ride not found.');
  if (ride.status !== 'completed') throw new ApiError(409, 'Only completed rides can be rated.');

  const target: RatingTarget = isRider ? 'driver' : 'rider';
  const toUserId = isRider ? ride.driver_id : ride.rider_id;
  if (!toUserId) throw new ApiError(409, 'This ride had no driver to rate.');

  const finishedAt = new Date(ride.completed_at ?? ride.updated_at).getTime();
  if (Date.now() - finishedAt > RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    throw new ApiError(409, `Ratings close ${RATING_WINDOW_DAYS} days after the trip.`);
  }

  const allowed = allowedTags(target);
  const unknown = input.tags.filter((tag) => !allowed.has(tag));
  if (unknown.length > 0) throw new ApiError(400, 'Some tags are not valid.', { tags: [`Unknown tag: ${unknown.join(', ')}`] });

  const { data, error: insertError } = await db
    .from('ratings')
    .insert({
      ride_id: ride.id,
      from_user_id: user.id,
      to_user_id: toUserId,
      rating: input.rating,
      review_text: input.reviewText ?? null,
      tags: [...new Set(input.tags)],
    })
    .select('*')
    .single();

  if (insertError || !data) {
    if (insertError?.code === '23505') throw new ApiError(409, 'You have already rated this ride.');
    if (insertError?.code === '23514') throw new ApiError(409, insertError.message);
    throw new Error(`Failed to save rating: ${insertError?.message ?? 'no row returned'}`);
  }

  await createNotification({
    userId: toUserId,
    type: 'rating_received',
    title: `New ${input.rating}★ rating`,
    message: input.reviewText ? `${user.full_name.split(' ')[0]}: "${input.reviewText.slice(0, 120)}"` : `${user.full_name.split(' ')[0]} rated your trip ${input.rating} out of 5.`,
    data: { rideId: ride.id, url: isRider ? '/driver/ratings' : `/driver/rides/${ride.id}` },
  });

  return data;
}

/** Average, distribution and most-used tags for everything a user has been rated. */
export async function getRatingSummary(userId: string): Promise<RatingSummary> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('ratings').select('rating, tags').eq('to_user_id', userId).limit(5000);
  if (error) throw new Error(`Failed to load ratings: ${error.message}`);

  const rows = data ?? [];
  const distribution = [5, 4, 3, 2, 1].map((stars) => rows.filter((row) => row.rating === stars).length);
  const counts = new Map<string, number>();
  rows.forEach((row) => row.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));

  return {
    average: rows.length ? Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) * 100) / 100 : 0,
    count: rows.length,
    distribution,
    topTags: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count })),
  };
}

/** Latest written reviews for a user, with the reviewer's first name + avatar only. */
export async function getReviews(userId: string, limit = 20): Promise<ReviewItem[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('ratings')
    .select('*')
    .eq('to_user_id', userId)
    .not('review_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load reviews: ${error.message}`);

  const rows = data ?? [];
  const authorIds = [...new Set(rows.map((row) => row.from_user_id))];
  const authors = authorIds.length ? await db.from('users').select('id, full_name, avatar_url').in('id', authorIds) : { data: [], error: null };
  if (authors.error) throw new Error(`Failed to load reviewers: ${authors.error.message}`);
  const byId = new Map((authors.data ?? []).map((author) => [author.id, author]));

  return rows.map((row) => {
    const author = byId.get(row.from_user_id);
    return {
      id: row.id,
      rating: row.rating,
      review_text: row.review_text,
      tags: row.tags,
      created_at: row.created_at,
      // Privacy: show "Asha R." rather than the full name.
      author: author ? { full_name: shortName(author.full_name), avatar_url: author.avatar_url } : null,
    };
  });
}

export function shortName(fullName: string): string {
  const [first = '', ...rest] = fullName.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

/** Public driver card for riders: only verified drivers are shown, and only non-sensitive fields. */
export async function getDriverPublicProfile(driverUserId: string): Promise<DriverPublicProfile | null> {
  const db = createSupabaseAdminClient();
  const { data: profile, error } = await db
    .from('driver_profiles')
    .select('vehicle_type, vehicle_model, vehicle_color, total_rides, is_verified, created_at')
    .eq('user_id', driverUserId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load driver profile: ${error.message}`);
  if (!profile || !profile.is_verified) return null;

  const { data: user, error: userError } = await db.from('users').select('id, full_name, avatar_url, is_active').eq('id', driverUserId).maybeSingle();
  if (userError) throw new Error(`Failed to load driver: ${userError.message}`);
  if (!user || !user.is_active) return null;

  const [summary, reviews] = await Promise.all([getRatingSummary(driverUserId), getReviews(driverUserId, 15)]);
  return {
    id: user.id,
    full_name: shortName(user.full_name),
    avatar_url: user.avatar_url,
    vehicle_type: profile.vehicle_type,
    vehicle_model: profile.vehicle_model,
    vehicle_color: profile.vehicle_color,
    total_rides: profile.total_rides,
    member_since: profile.created_at,
    summary,
    reviews,
  };
}

/** The rating `userId` left for a ride (either direction), or null. */
export async function getOwnRating(rideId: string, userId: string): Promise<Rating | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('ratings').select('*').eq('ride_id', rideId).eq('from_user_id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load rating: ${error.message}`);
  return data;
}
