import { z } from 'zod';

import { ok, parseBody, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { getOwnRating, submitRating } from '@/lib/ratings/service';
import { createRatingSchema, uuidSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ratings  { rideId, rating, reviewText?, tags? }
 * The rider rates the driver, or the driver rates the rider — decided by who the caller is on that ride.
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const input = await parseBody(request, createRatingSchema);
  return ok(await submitRating(user, input), 201);
}, 'POST /api/ratings', { rateLimit: RATE_LIMITS.content });

/** GET /api/ratings?rideId=… — the rating the caller already left for that ride (or null). */
export const GET = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const { rideId } = parseQuery(request, z.object({ rideId: uuidSchema }));

  return ok(await getOwnRating(rideId, user.id));
});
