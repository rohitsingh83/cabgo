import { ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { createCheckoutForRide } from '@/lib/payments/stripe-flow';
import { createCheckoutSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

/** POST /api/payments/checkout  { rideId } → { url } — Stripe-hosted Checkout alternative. */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider']);
  const { rideId } = await parseBody(request, createCheckoutSchema);
  return ok(await createCheckoutForRide(user, rideId));
}, 'POST /api/payments/checkout', { rateLimit: RATE_LIMITS.payments });
