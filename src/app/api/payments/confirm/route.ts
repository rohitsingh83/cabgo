import { ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { confirmPaymentForUser } from '@/lib/payments/stripe-flow';
import { confirmPaymentSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/payments/confirm  { paymentIntentId } | { sessionId }
 *
 * The browser calls this right after Stripe reports success so the UI updates instantly. The server
 * re-reads the intent from Stripe and settles it; the webhook does the same, idempotently.
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider']);
  const input = await parseBody(request, confirmPaymentSchema);
  return ok(await confirmPaymentForUser(user, input));
}, 'POST /api/payments/confirm', { rateLimit: RATE_LIMITS.payments });
