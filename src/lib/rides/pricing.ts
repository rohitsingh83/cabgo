import 'server-only';

import { BUSINESS_RULES, VEHICLE_TYPES, VEHICLES } from '@/lib/constants';
import { calculateFare, calculateSurgeMultiplier } from '@/lib/fare';
import { getRoute } from '@/lib/google-maps/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { roundTo } from '@/lib/utils';
import type {
  FareEstimate,
  FareEstimateResponse,
  LatLng,
  NearbyDriver,
  Place,
  VehicleType,
} from '@/types';

/** Open ride requests older than this no longer count as demand. */
const DEMAND_WINDOW_MINUTES = 15;

export interface QuoteInput {
  pickup: Place;
  dropoff: Place;
  stops: Place[];
  promoCode?: string;
}

/** Drivers → minutes until they could reach `distanceKm`, scaled for the vehicle type. */
function driverEtaMinutes(distanceKm: number, type: VehicleType): number {
  const base = (distanceKm / 24) * 60 * VEHICLES[type].etaFactor;
  return Math.max(1, Math.ceil(base) + 1); // +1 min to accept & start moving
}

/**
 * Demand = open requests near the pickup (+1 for this prospective rider)
 * Supply = idle, online drivers inside the matching radius.
 * The ratio drives the surge multiplier (see calculateSurgeMultiplier).
 */
async function loadMarket(pickup: LatLng): Promise<{ drivers: NearbyDriver[]; demand: number }> {
  const db = createSupabaseAdminClient();
  const radius = BUSINESS_RULES.matchingRadiusKm;
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.max(Math.cos((pickup.lat * Math.PI) / 180), 0.01));
  const since = new Date(Date.now() - DEMAND_WINDOW_MINUTES * 60_000).toISOString();

  const [driversResult, demandResult] = await Promise.all([
    db.rpc('find_nearby_drivers', {
      p_lat: pickup.lat,
      p_lng: pickup.lng,
      p_radius_km: radius,
      p_ride_type: null,
      p_limit: 100,
    }),
    db
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .in('status', ['requested', 'searching'])
      .gte('created_at', since)
      .gte('pickup_lat', pickup.lat - latDelta)
      .lte('pickup_lat', pickup.lat + latDelta)
      .gte('pickup_lng', pickup.lng - lngDelta)
      .lte('pickup_lng', pickup.lng + lngDelta),
  ]);

  if (driversResult.error) throw new Error(`find_nearby_drivers failed: ${driversResult.error.message}`);
  if (demandResult.error) throw new Error(`Demand query failed: ${demandResult.error.message}`);

  return { drivers: driversResult.data ?? [], demand: (demandResult.count ?? 0) + 1 };
}

interface PromoOutcome {
  valid: boolean;
  message: string;
  promoId: string | null;
  discountAmount: number;
}

async function checkPromo(code: string, fare: number): Promise<PromoOutcome> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc('validate_promo_code', { p_code: code, p_fare: fare });
  if (error) throw new Error(`validate_promo_code failed: ${error.message}`);

  const row = data?.[0];
  if (!row) return { valid: false, message: 'Invalid promo code', promoId: null, discountAmount: 0 };
  return {
    valid: row.valid,
    message: row.message,
    promoId: row.promo_id,
    discountAmount: row.valid ? Number(row.discount_amount) : 0,
  };
}

/**
 * The single source of truth for ride prices. Used by /api/fare-estimate (all vehicle
 * types) and /api/rides (one type) so the number the rider confirms is the number charged.
 */
export async function quoteRide(
  input: QuoteInput,
  rideTypes: readonly VehicleType[] = VEHICLE_TYPES,
): Promise<FareEstimateResponse & { promoIds: Partial<Record<VehicleType, string>> }> {
  const points: LatLng[] = [input.pickup, ...input.stops, input.dropoff];
  const [route, market] = await Promise.all([getRoute(points), loadMarket(input.pickup)]);

  const surgeMultiplier = calculateSurgeMultiplier(market.demand, market.drivers.length);
  const promoIds: Partial<Record<VehicleType, string>> = {};
  let promoMessage = '';
  let promoAppliedAnywhere = false;

  const estimates: FareEstimate[] = [];
  for (const rideType of rideTypes) {
    const base = {
      vehicleType: rideType,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      stops: input.stops.length,
      surgeMultiplier,
    };

    let breakdown = calculateFare(base);
    let promo: FareEstimate['promo'] = null;

    if (input.promoCode) {
      // Promo thresholds (min fare) are checked against the pre-discount subtotal.
      const outcome = await checkPromo(input.promoCode, breakdown.subtotal);
      promoMessage = promoMessage || outcome.message;
      if (outcome.valid && outcome.promoId) {
        breakdown = calculateFare({ ...base, discount: outcome.discountAmount });
        promo = { code: input.promoCode, promoId: outcome.promoId, discountAmount: breakdown.discount };
        promoIds[rideType] = outcome.promoId;
        promoAppliedAnywhere = true;
        promoMessage = outcome.message;
      }
    }

    const nearest = market.drivers
      .filter((driver) => driver.vehicle_type === rideType)
      .reduce<number | null>((min, driver) => (min === null || driver.distance_km < min ? driver.distance_km : min), null);

    estimates.push({
      rideType,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      surgeMultiplier,
      breakdown,
      etaMinutes: nearest === null ? null : driverEtaMinutes(nearest, rideType),
      promo,
    });
  }

  return {
    route: {
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      polyline: route.polyline,
      approximate: route.approximate,
    },
    surge: { multiplier: surgeMultiplier, demand: market.demand, supply: market.drivers.length },
    estimates,
    promo: input.promoCode
      ? {
          code: input.promoCode,
          valid: promoAppliedAnywhere,
          message: promoAppliedAnywhere ? promoMessage || 'Promo applied' : promoMessage || 'Invalid promo code',
        }
      : null,
    nearbyDrivers: market.drivers.length,
    promoIds,
  };
}

/** Rounds a rupee amount for comparisons (client sends 2-dp values). */
export function sameAmount(a: number, b: number): boolean {
  return Math.abs(roundTo(a) - roundTo(b)) < 0.51; // tolerate rounding, not repricing
}
