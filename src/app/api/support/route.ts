import { ok, parseBody, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { createTicket, listTickets } from '@/lib/support/service';
import { createTicketSchema, ticketsQuerySchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** GET /api/support?page=&status= — the caller's own tickets, newest first. */
export const GET = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const query = parseQuery(request, ticketsQuerySchema);
  return ok(await listTickets(user, query));
});

/** POST /api/support  { category, subject, description, rideId? } — open a ticket; admins are notified. */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const input = await parseBody(request, createTicketSchema);
  return ok(await createTicket(user, input), 201);
}, 'POST /api/support', { rateLimit: RATE_LIMITS.content });
