import { ok, parseBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { deletePromo, updatePromo } from '@/lib/admin/promos';
import { updatePromoSchema, uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/promo/[id] — partial update (also used by the active/inactive switch). */
export const PATCH = withApi<{ id: string }>(async (request, { params }) => {
  await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'promo id');
  const patch = await parseBody(request, updatePromoSchema);
  return ok(await updatePromo(id, patch));
}, 'PATCH /api/admin/promo/[id]');

/** DELETE /api/admin/promo/[id] — only for codes that were never redeemed. */
export const DELETE = withApi<{ id: string }>(async (_request, { params }) => {
  await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'promo id');
  await deletePromo(id);
  return ok({ id });
}, 'DELETE /api/admin/promo/[id]');
