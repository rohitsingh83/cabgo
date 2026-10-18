import { ApiError, ok, parseParam, requireApiUser, withApi } from '@/lib/api';
import { canAccessRide, getRideWithRelations } from '@/lib/rides/service';
import { uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** GET /api/rides/[id] — a single ride with rider, driver, vehicle, payment and rating. */
export const GET = withApi<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser();
  const id = parseParam(uuidSchema, params.id, 'ride id');

  const ride = await getRideWithRelations(id);
  // 404 (not 403) for other people's rides so ids cannot be probed.
  if (!ride || !canAccessRide(user, ride)) throw new ApiError(404, 'Ride not found');

  return ok(ride);
}, 'GET /api/rides/[id]');
