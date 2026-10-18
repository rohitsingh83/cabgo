import { ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { quoteRide } from '@/lib/rides/pricing';
import { fareEstimateSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/fare-estimate
 * Resolves the route (Google Directions), measures live demand/supply for surge, and returns
 * one itemised quote per vehicle type, with an optional promo code applied.
 */
export const POST = withApi(async (request) => {
  await requireApiUser(['rider']);
  const input = await parseBody(request, fareEstimateSchema);

  const { promoIds: _promoIds, ...response } = await quoteRide({
    pickup: input.pickup,
    dropoff: input.dropoff,
    stops: input.stops,
    promoCode: input.promoCode,
  });
  return ok(response);
}, 'POST /api/fare-estimate', { rateLimit: RATE_LIMITS.maps });
