import { ok, parseBody, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { createPromo, listPromos } from '@/lib/admin/promos';
import { adminPromoQuerySchema, createPromoSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** GET /api/admin/promo?status=all|active|scheduled|expired|inactive */
export const GET = withApi(async (request) => {
  await requireApiUser(['admin']);
  const { status } = parseQuery(request, adminPromoQuerySchema);
  return ok(await listPromos(status));
}, 'GET /api/admin/promo');

/** POST /api/admin/promo — create a promo code (codes are unique, case-insensitively). */
export const POST = withApi(async (request) => {
  await requireApiUser(['admin']);
  const input = await parseBody(request, createPromoSchema);
  return ok(await createPromo(input), 201);
}, 'POST /api/admin/promo');
