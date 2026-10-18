import { ok, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { geocodeAddress, isMapsConfigured, reverseGeocode } from '@/lib/google-maps/server';
import { geocodeQuerySchema } from '@/lib/validations';
import type { Place } from '@/types';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/geocode?q=Charminar          → forward geocoding (candidate places)
 * GET /api/geocode?lat=17.38&lng=78.48  → reverse geocoding (address of a point)
 * Always responds with `{ places, configured }` so the UI can explain a missing Maps key.
 */
export const GET = withApi(async (request) => {
  await requireApiUser();
  const query = parseQuery(request, geocodeQuerySchema);

  let places: Place[] = [];
  if (query.q) {
    places = await geocodeAddress(query.q);
  } else if (query.lat !== undefined && query.lng !== undefined) {
    const place = await reverseGeocode({ lat: query.lat, lng: query.lng });
    places = place ? [place] : [];
  }

  return ok({ places, configured: isMapsConfigured() });
}, 'GET /api/geocode', { rateLimit: RATE_LIMITS.maps });
