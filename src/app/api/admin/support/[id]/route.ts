import { ok, parseBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { updateTicket } from '@/lib/admin/support';
import { adminTicketUpdateSchema, uuidSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/support/[id]  { status, response? } — reply to and/or re-status a ticket. */
export const PATCH = withApi<{ id: string }>(async (request, { params }) => {
  const admin = await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'ticket id');
  const input = await parseBody(request, adminTicketUpdateSchema);
  return ok(await updateTicket(admin, id, input));
}, 'PATCH /api/admin/support/[id]');
