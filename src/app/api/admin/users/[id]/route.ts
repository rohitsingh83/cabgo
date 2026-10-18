import { ok, parseBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { setUserActive } from '@/lib/admin/users';
import { updateUserStatusSchema, uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/users/[id]  { isActive, reason? } — suspend or reinstate an account. */
export const PATCH = withApi<{ id: string }>(async (request, { params }) => {
  const admin = await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'user id');
  const { isActive, reason } = await parseBody(request, updateUserStatusSchema);
  return ok(await setUserActive(admin, id, isActive, reason));
}, 'PATCH /api/admin/users/[id]');
