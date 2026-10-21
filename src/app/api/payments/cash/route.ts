import { ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { payWithCashOrDemo } from '@/lib/payments/stripe-flow';
import { createPaymentIntentSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/payments/cash  { rideId }
 *
 * Marks a completed ride or cancellation fee as paid via Cash or Demo mode.
 * Immediately completes the payment and notifies the participants and admin dashboard.
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider']);
  const { rideId } = await parseBody(request, createPaymentIntentSchema);
  return ok(await payWithCashOrDemo(user, rideId));
}, 'POST /api/payments/cash', { rateLimit: RATE_LIMITS.payments });
