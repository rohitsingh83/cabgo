import { haversineKm } from '@/lib/utils';
import type { LatLng } from '@/types';

/** Straight lines under-estimate road distance; 1.3 is a typical urban detour factor. */
const ROAD_FACTOR = 1.3;
const FALLBACK_SPEED_KMH = 22;

export interface LiveEta {
  /** Approximate remaining road distance. */
  distanceKm: number;
  minutes: number;
}

/**
 * Rough ETA from a live position — good enough for a "~4 min away" label between Directions calls.
 * Uses the driver's current speed when they are actually moving, otherwise a city average.
 */
export function estimateEta(from: LatLng, to: LatLng, speedKmh?: number | null): LiveEta {
  const distanceKm = haversineKm(from, to) * ROAD_FACTOR;
  const speed = speedKmh && speedKmh >= 8 ? Math.min(Math.max(speedKmh, 12), 50) : FALLBACK_SPEED_KMH;
  return { distanceKm, minutes: Math.max(1, Math.round((distanceKm / speed) * 60)) };
}
