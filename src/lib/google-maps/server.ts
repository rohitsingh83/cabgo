import 'server-only';

import { haversineKm, roundTo } from '@/lib/utils';
import type { LatLng, Place, RouteInfo } from '@/types';

/**
 * Server-side Google Maps Platform access (Directions + Geocoding REST APIs).
 *
 * Fares are always computed from a route resolved here — never from client-supplied
 * distances — so riders cannot tamper with prices. When no server key is configured or the
 * API is unavailable we fall back to a great-circle estimate so the app keeps working in
 * development (the response is flagged with `approximate: true`).
 */

const ROUTES_COMPUTE_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_SEARCH_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Typical road-vs-straight-line ratio used by the offline fallback. */
const ROAD_FACTOR = 1.35;
/** Average urban speed (km/h) used by the offline fallback. */
const FALLBACK_SPEED_KMH = 24;

function serverKey(): string | null {
  // First *real-looking* key wins, so a placeholder server key can't shadow a valid public one.
  const candidates = [process.env.GOOGLE_MAPS_SERVER_API_KEY, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY];
  return candidates.find((key): key is string => Boolean(key && /^AIza[\w-]{30,}$/.test(key) && !key.includes('xxxxxxxx'))) ?? null;
}

export function isMapsConfigured(): boolean {
  return serverKey() !== null;
}

export interface ResolvedRoute extends RouteInfo {
  /** True when the numbers come from the straight-line fallback instead of Google. */
  approximate: boolean;
}

interface ComputeRoutesResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string; // e.g. "2652s"
    polyline?: { encodedPolyline?: string };
  }>;
  error?: { message?: string; status?: string };
}

interface DirectionsResponse {
  status: string;
  error_message?: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{ distance?: { value: number }; duration?: { value: number } }>;
  }>;
}

const fmt = (point: LatLng) => `${point.lat},${point.lng}`;

/** Offline estimate: haversine along pickup → stops → dropoff, scaled to road distance. */
function estimateRoute(points: LatLng[]): ResolvedRoute {
  let km = 0;
  for (let i = 1; i < points.length; i += 1) km += haversineKm(points[i - 1], points[i]);
  const distanceKm = roundTo(km * ROAD_FACTOR, 2);
  return {
    distanceKm,
    durationMinutes: roundTo((distanceKm / FALLBACK_SPEED_KMH) * 60, 1),
    polyline: null,
    approximate: true,
  };
}

/**
 * Driving route through every waypoint, in order.
 * `points` = [pickup, ...stops, dropoff] (at least two).
 * Tries modern Google Routes API v2 (computeRoutes), then legacy Directions API, then offline estimate.
 */
export async function getRoute(points: LatLng[]): Promise<ResolvedRoute> {
  if (points.length < 2) throw new Error('A route needs at least two points');
  const key = serverKey();
  if (!isMapsConfigured() || !key) return estimateRoute(points);

  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1);

  // 1. Try modern Routes API v2
  try {
    const intermediates = waypoints.map((w) => ({
      location: { latLng: { latitude: w.lat, longitude: w.lng } },
    }));

    const response = await fetch(ROUTES_COMPUTE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        ...(intermediates.length > 0 ? { intermediates } : {}),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
      cache: 'no-store',
    });

    if (response.ok) {
      const data = (await response.json()) as ComputeRoutesResponse;
      const primaryRoute = data.routes?.[0];
      if (primaryRoute && primaryRoute.distanceMeters !== undefined) {
        const meters = primaryRoute.distanceMeters;
        const seconds = parseInt(primaryRoute.duration || '0', 10) || 0;
        return {
          distanceKm: roundTo(meters / 1000, 2),
          durationMinutes: roundTo(seconds / 60, 1),
          polyline: primaryRoute.polyline?.encodedPolyline ?? null,
          approximate: false,
        };
      }
    }
  } catch (err) {
    console.warn('[maps] Routes API v2 error, falling back to legacy Directions:', err);
  }

  // 2. Fallback to legacy Directions API
  const params = new URLSearchParams({
    origin: fmt(origin),
    destination: fmt(destination),
    mode: 'driving',
    departure_time: 'now', // enables traffic-aware duration
    key,
  });
  if (waypoints.length > 0) params.set('waypoints', waypoints.map(fmt).join('|'));

  try {
    const response = await fetch(`${DIRECTIONS_URL}?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Directions HTTP ${response.status}`);
    const json = (await response.json()) as DirectionsResponse;

    const route = json.routes?.[0];
    if (json.status !== 'OK' || !route?.legs?.length) {
      console.warn('[maps] Directions API unavailable, using estimate:', json.status, json.error_message);
      return estimateRoute(points);
    }

    // Sum every leg (one per segment between waypoints).
    const meters = route.legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
    const seconds = route.legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
    return {
      distanceKm: roundTo(meters / 1000, 2),
      durationMinutes: roundTo(seconds / 60, 1),
      polyline: route.overview_polyline?.points ?? null,
      approximate: false,
    };
  } catch (error) {
    console.warn('[maps] Directions request failed, using estimate:', error);
    return estimateRoute(points);
  }
}

interface PlacesSearchResponse {
  places?: Array<{
    id?: string;
    formattedAddress?: string;
    displayName?: { text?: string };
    location?: { latitude: number; longitude: number };
  }>;
}

interface GeocodeResponse {
  status: string;
  error_message?: string;
  results?: Array<{
    formatted_address: string;
    place_id: string;
    geometry: { location: { lat: number; lng: number } };
    address_components?: Array<{ long_name: string; types: string[] }>;
  }>;
}

function toPlace(result: NonNullable<GeocodeResponse['results']>[number]): Place {
  const locality = result.address_components?.find((c) => c.types.includes('sublocality') || c.types.includes('locality'));
  return {
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    placeId: result.place_id,
    name: locality?.long_name,
  };
}

async function callLegacyGeocode(params: Record<string, string>): Promise<Place[]> {
  const key = serverKey();
  if (!isMapsConfigured() || !key) return [];

  const query = new URLSearchParams({ ...params, key });
  const response = await fetch(`${GEOCODE_URL}?${query.toString()}`, { cache: 'no-store' });
  if (!response.ok) return [];
  const json = (await response.json()) as GeocodeResponse;

  if (json.status !== 'OK' || !json.results) return [];
  return json.results.slice(0, 6).map(toPlace);
}

/** Address text → candidate places. Tries modern Places API New, then legacy Geocoding. */
export async function geocodeAddress(query: string): Promise<Place[]> {
  const key = serverKey();
  if (!isMapsConfigured() || !key) return [];

  // 1. Try modern Places API (New) searchText
  try {
    const regionCode = (process.env.NEXT_PUBLIC_MAPS_REGION ?? 'IN').toUpperCase();
    const res = await fetch(PLACES_SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
        regionCode,
        maxResultCount: 6,
      }),
      cache: 'no-store',
    });

    if (res.ok) {
      const data = (await res.json()) as PlacesSearchResponse;
      if (data.places && data.places.length > 0) {
        return data.places
          .filter((p) => p.location && (p.formattedAddress || p.displayName?.text))
          .map((p) => ({
            placeId: p.id || `place_${Math.random().toString(36).slice(2, 9)}`,
            address: p.formattedAddress || p.displayName?.text || '',
            lat: p.location!.latitude,
            lng: p.location!.longitude,
            name: p.displayName?.text || p.formattedAddress?.split(',')[0],
          }));
      }
    }
  } catch (err) {
    console.warn('[maps] Places API searchText error, falling back to legacy geocoding:', err);
  }

  // 2. Fallback to legacy geocode
  return callLegacyGeocode({ address: query, region: process.env.NEXT_PUBLIC_MAPS_REGION ?? 'in' });
}

/** Coordinates → best street address. Tries modern Places API searchNearby, then legacy reverse geocode. */
export async function reverseGeocode(point: LatLng): Promise<Place | null> {
  const key = serverKey();
  if (!isMapsConfigured() || !key) {
    return {
      address: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
      lat: point.lat,
      lng: point.lng,
      name: 'Pinned Location',
    };
  }

  // 1. Try Places API (New) searchNearby
  try {
    const res = await fetch(PLACES_SEARCH_NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: point.lat, longitude: point.lng },
            radius: 500.0,
          },
        },
        maxResultCount: 1,
      }),
      cache: 'no-store',
    });

    if (res.ok) {
      const data = (await res.json()) as PlacesSearchResponse;
      const place = data.places?.[0];
      if (place && place.location) {
        return {
          placeId: place.id || `place_${Math.random().toString(36).slice(2, 9)}`,
          address: place.formattedAddress || place.displayName?.text || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
          lat: place.location.latitude,
          lng: place.location.longitude,
          name: place.displayName?.text || place.formattedAddress?.split(',')[0],
        };
      }
    }
  } catch (err) {
    console.warn('[maps] Places API searchNearby error, falling back to legacy reverse geocode:', err);
  }

  // 2. Fallback to legacy reverse geocode
  const results = await callLegacyGeocode({ latlng: fmt(point) });
  if (results[0]) return results[0];

  // 3. Coordinate fallback
  return {
    address: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
    lat: point.lat,
    lng: point.lng,
    name: 'Pinned Location',
  };
}
