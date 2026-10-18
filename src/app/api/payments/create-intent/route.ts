import { ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { createPaymentIntentForRide } from '@/lib/payments/stripe-flow';
import { createPaymentIntentSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/payments/create-intent  { rideId }
 *
 * Creates (or reuses) the Stripe PaymentIntent for a completed ride or a late-cancellation fee and
 * returns its client secret for the Payment Element. The amount is derived server-side.
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider']);
  const { rideId } = await parseBody(request, createPaymentIntentSchema);
  return ok(await createPaymentIntentForRide(user, rideId));
}, 'POST /api/payments/create-intent', { rateLimit: RATE_LIMITS.payments });
