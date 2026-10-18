import { ApiError, ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { profileUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** GET /api/users/me — the signed-in user's profile (hydrates the Zustand user store). */
export const GET = withApi(async () => {
  const user = await requireApiUser();
  return ok(user);
}, 'GET /api/users/me');

/**
 * PATCH /api/users/me — update own profile fields.
 * Role, clerk id and activation state can never be changed here.
 */
export const PATCH = withApi(async (request) => {
  const user = await requireApiUser();
  const input = await parseBody(request, profileUpdateSchema);

  const changes: { full_name?: string; phone?: string; avatar_url?: string | null } = {};
  if (input.fullName !== undefined) changes.full_name = input.fullName;
  if (input.phone !== undefined) changes.phone = input.phone;
  if (input.avatarUrl !== undefined) changes.avatar_url = input.avatarUrl;

  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('users').update(changes).eq('id', user.id).select('*').single();

  if (error) {
    if (error.code === '23505') throw new ApiError(409, 'That phone number is already registered');
    throw new Error(`profile update failed: ${error.message}`);
  }
  return ok(data);
}, 'PATCH /api/users/me');
