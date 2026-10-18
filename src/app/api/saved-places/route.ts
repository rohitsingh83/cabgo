import { ApiError, ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { savedPlaceSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

const MAX_SAVED_PLACES = 20;

/** GET /api/saved-places — Home, Work, then custom places (oldest first). */
export const GET = withApi(async () => {
  const user = await requireApiUser();
  const db = createSupabaseAdminClient();

  const { data, error } = await db
    .from('saved_places')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to load saved places: ${error.message}`);

  const rank = { home: 0, work: 1, custom: 2 } as const;
  return ok([...(data ?? [])].sort((a, b) => rank[a.label] - rank[b.label]));
}, 'GET /api/saved-places');

/** POST /api/saved-places — Home and Work are unique (saving again replaces them). */
export const POST = withApi(async (request) => {
  const user = await requireApiUser();
  const input = await parseBody(request, savedPlaceSchema);
  const db = createSupabaseAdminClient();

  if (input.label === 'custom') {
    const { count, error: countError } = await db
      .from('saved_places')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (countError) throw new Error(`Failed to count saved places: ${countError.message}`);
    if ((count ?? 0) >= MAX_SAVED_PLACES) {
      throw new ApiError(400, `You can save up to ${MAX_SAVED_PLACES} places. Remove one first.`);
    }
  } else {
    // Replace the existing Home/Work entry (partial unique index: one per user per label).
    const { error: deleteError } = await db
      .from('saved_places')
      .delete()
      .eq('user_id', user.id)
      .eq('label', input.label);
    if (deleteError) throw new Error(`Failed to replace saved place: ${deleteError.message}`);
  }

  const { data, error } = await db
    .from('saved_places')
    .insert({
      user_id: user.id,
      label: input.label,
      name: input.label === 'custom' ? input.name ?? null : null,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to save place: ${error?.message ?? 'no row returned'}`);

  return ok(data, 201);
}, 'POST /api/saved-places');
