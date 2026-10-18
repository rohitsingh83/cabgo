import 'server-only';

import { ACTIVE_RIDE_STATUSES } from '@/lib/constants';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Ride, SavedPlace } from '@/types';

/** The rider's most recent live ride (requested → in progress), or null. */
export async function getActiveRideForRider(riderId: string): Promise<Ride | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('rides')
    .select('*')
    .eq('rider_id', riderId)
    .in('status', [...ACTIVE_RIDE_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load active ride: ${error.message}`);
  return data;
}

/** Home, Work, then favourites. */
export async function getSavedPlacesForUser(userId: string): Promise<SavedPlace[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('saved_places')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to load saved places: ${error.message}`);

  const rank = { home: 0, work: 1, custom: 2 } as const;
  return [...(data ?? [])].sort((a, b) => rank[a.label] - rank[b.label]);
}
