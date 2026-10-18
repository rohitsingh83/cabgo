import { ApiError, ok, parseParam, requireApiUser, withApi } from '@/lib/api';
import { getDriverPublicProfile } from '@/lib/ratings/service';
import { uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** GET /api/drivers/[id] — a verified driver's public card: vehicle, rating summary and recent reviews. */
export const GET = withApi<{ id: string }>(async (_request, { params }) => {
  await requireApiUser(['rider', 'driver', 'admin']);
  const id = parseParam(uuidSchema, params.id, 'driver id');
  const profile = await getDriverPublicProfile(id);
  if (!profile) throw new ApiError(404, 'Driver not found.');
  return ok(profile);
});
