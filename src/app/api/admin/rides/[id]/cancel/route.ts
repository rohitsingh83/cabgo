import { ok, parseBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { adminCancelRide } from '@/lib/admin/rides';
import { adminCancelRideSchema, uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** POST /api/admin/rides/[id]/cancel  { reason } — support cancels a live ride (no fee for the rider). */
export const POST = withApi<{ id: string }>(async (request, { params }) => {
  const admin = await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'ride id');
  const { reason } = await parseBody(request, adminCancelRideSchema);
  return ok(await adminCancelRide(admin, id, reason));
}, 'POST /api/admin/rides/[id]/cancel');
