import {
  BOOKING_FEE,
  CURRENCY,
  STOP_FEE,
  SURGE_MAX,
  SURGE_MIN,
  SURGE_SATURATION_RATIO,
  SURGE_THRESHOLD_RATIO,
  TAX_RATE,
  VEHICLES,
} from '@/lib/constants';
import { clamp, roundTo } from '@/lib/utils';
import type { FareBreakdown, VehicleType } from '@/types';

/**
 * Pure fare maths shared by the landing-page estimator, the booking flow (client preview)
 * and the API routes (authoritative price). Keeping it side-effect free means the number a
 * rider sees is always the number the server charges.
 */

export interface FareInput {
  vehicleType: VehicleType;
  distanceKm: number;
  durationMinutes: number;
  /** Number of intermediate stops (each adds a flat STOP_FEE). */
  stops?: number;
  /** 1.0 = no surge. Clamped to [SURGE_MIN, SURGE_MAX]. */
  surgeMultiplier?: number;
  /** Absolute discount in currency units (already resolved from a promo code). */
  discount?: number;
}

/**
 * Map a demand/supply ratio to a surge multiplier.
 *
 *   ratio ≤ SURGE_THRESHOLD_RATIO      → 1.0x (no surge)
 *   ratio ≥ SURGE_SATURATION_RATIO     → SURGE_MAX
 *   in between                         → linear interpolation, rounded to 0.1x
 *
 * `demand` = open ride requests around the pickup, `supply` = online, idle drivers nearby.
 * With zero supply the ratio is treated as `demand` so a lone request never explodes to max.
 */
export function calculateSurgeMultiplier(demand: number, supply: number): number {
  if (demand <= 0) return SURGE_MIN;
  const ratio = supply <= 0 ? demand : demand / supply;
  if (ratio <= SURGE_THRESHOLD_RATIO) return SURGE_MIN;
  if (ratio >= SURGE_SATURATION_RATIO) return SURGE_MAX;

  const progress = (ratio - SURGE_THRESHOLD_RATIO) / (SURGE_SATURATION_RATIO - SURGE_THRESHOLD_RATIO);
  const raw = SURGE_MIN + progress * (SURGE_MAX - SURGE_MIN);
  return clamp(Math.round(raw * 10) / 10, SURGE_MIN, SURGE_MAX);
}

/**
 * Itemised fare.
 *
 * ride fare  = max(minimumFare, base + perKm × km + perMinute × min)
 * surge      = ride fare × (multiplier − 1)            (stop & booking fees are never surged)
 * subtotal   = ride fare + surge + stops + booking fee
 * tax (GST)  = (subtotal − discount) × TAX_RATE
 *
 * When the minimum fare kicks in, the top-up is folded into `baseFare` so the visible line
 * items always add up to the subtotal.
 */
export function calculateFare(input: FareInput): FareBreakdown {
  const vehicle = VEHICLES[input.vehicleType];
  const distanceKm = Math.max(0, input.distanceKm);
  const durationMinutes = Math.max(0, input.durationMinutes);
  const stops = Math.max(0, Math.floor(input.stops ?? 0));
  const surge = clamp(input.surgeMultiplier ?? 1, SURGE_MIN, SURGE_MAX);

  const distanceFare = vehicle.perKm * distanceKm;
  const timeFare = vehicle.perMinute * durationMinutes;
  const metered = vehicle.baseFare + distanceFare + timeFare;
  const minimumTopUp = Math.max(0, vehicle.minimumFare - metered);
  const baseFare = vehicle.baseFare + minimumTopUp;
  const rideFare = baseFare + distanceFare + timeFare;

  const surgeAmount = rideFare * (surge - 1);
  const stopsFee = stops * STOP_FEE;
  const subtotal = rideFare + surgeAmount + stopsFee + BOOKING_FEE;

  const discount = clamp(input.discount ?? 0, 0, subtotal);
  const tax = (subtotal - discount) * TAX_RATE;
  const total = subtotal - discount + tax;

  return {
    baseFare: roundTo(baseFare),
    distanceFare: roundTo(distanceFare),
    timeFare: roundTo(timeFare),
    bookingFee: BOOKING_FEE,
    surgeAmount: roundTo(surgeAmount),
    stopsFee,
    subtotal: roundTo(subtotal),
    discount: roundTo(discount),
    tax: roundTo(tax),
    total: roundTo(total),
    currency: CURRENCY,
  };
}

/** Rough travel-time guess (minutes) used only where no routing data is available (landing page). */
export function estimateDurationMinutes(distanceKm: number, vehicleType: VehicleType): number {
  // ~24 km/h average urban speed, scaled by the vehicle's agility factor.
  const base = (distanceKm / 24) * 60;
  return Math.max(3, Math.round(base * VEHICLES[vehicleType].etaFactor));
}
