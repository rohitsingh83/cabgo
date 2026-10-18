import { ApiError, ok, parseParam, requireApiUser, withApi } from '@/lib/api';
import { getTicket } from '@/lib/support/service';
import { uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** GET /api/support/[id] — one of the caller's tickets (404 for anyone else's). */
export const GET = withApi<{ id: string }>(async (_request, { params }) => {
  const user = await requireApiUser(['rider', 'driver']);
  const id = parseParam(uuidSchema, params.id, 'ticket id');
  const ticket = await getTicket(user, id);
  if (!ticket) throw new ApiError(404, 'Ticket not found.');
  return ok(ticket);
});
