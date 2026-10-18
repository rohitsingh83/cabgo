import { ApiError, ok, parseParam, requireApiUser, withApi } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { uuidSchema } from '@/lib/validations';

/** DELETE /api/saved-places/[id] — only the owner can remove a place. */
export const DELETE = withApi<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const id = parseParam(uuidSchema, params.id, 'place id');
  const db = createSupabaseAdminClient();

  const { data, error } = await db
    .from('saved_places')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Failed to delete saved place: ${error.message}`);
  if (!data) throw new ApiError(404, 'Saved place not found');

  return ok({ id: data.id });
}, 'DELETE /api/saved-places/[id]');
