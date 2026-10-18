import { ok, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { listPayments } from '@/lib/payments/service';
import { paymentsQuerySchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** GET /api/payments/history?page=1&status=all — riders: what they paid · drivers: what they earned · admins: all. */
export const GET = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver', 'admin']);
  const query = parseQuery(request, paymentsQuerySchema);
  return ok(await listPayments(user, query));
});
