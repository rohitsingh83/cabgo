import { z } from 'zod';

import { ok, parseBody, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { getActiveSosResult, triggerSos } from '@/lib/safety/sos';
import { triggerSosSchema, uuidSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sos  { rideId, lat, lng, source? }
 * Stores the alert, texts the emergency contacts (if SMS is configured) and alerts admins in real time.
 * Idempotent per user + ride: a repeat call returns the existing alert (`duplicate: true`).
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const input = await parseBody(request, triggerSosSchema);
  const result = await triggerSos(user, input);
  return ok(result, result.duplicate ? 200 : 201);
}, 'POST /api/sos', { rateLimit: RATE_LIMITS.sos });

/** GET /api/sos?rideId=… — the caller's active alert for that ride, or null (restores the UI after a reload). */
export const GET = withApi(async (request) => {
  const user = await requireApiUser(['rider', 'driver']);
  const { rideId } = parseQuery(request, z.object({ rideId: uuidSchema }));
  return ok(await getActiveSosResult(user, rideId));
});
