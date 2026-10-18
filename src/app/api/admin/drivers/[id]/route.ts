import { ok, parseBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { reviewDriver } from '@/lib/admin/drivers';
import { reviewDriverSchema, uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/drivers/[id]  { action: 'approve' } | { action: 'reject', reason } — [id] is the driver's user id. */
export const PATCH = withApi<{ id: string }>(async (request, { params }) => {
  const admin = await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'driver id');
  const input = await parseBody(request, reviewDriverSchema);
  return ok(await reviewDriver(admin, id, input));
}, 'PATCH /api/admin/drivers/[id]');
