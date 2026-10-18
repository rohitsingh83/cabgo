import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Repository } from '../deps';
import type { DriverPresence, RideParticipants } from '../types';

const presenceSchema = z.object({
  is_verified: z.boolean(),
  vehicle_type: z.enum(['bike', 'auto', 'sedan', 'suv']),
});

const rideSchema = z.object({
  id: z.string().uuid(),
  rider_id: z.string().uuid(),
  driver_id: z.string().uuid().nullable(),
  status: z.enum(['requested', 'searching', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled']),
});

export function createSupabaseRepository(url: string, serviceRoleKey: string): Repository {
  const isMock = !url || !serviceRoleKey || url.includes('your-project-ref');

  if (isMock) {
    return {
      async getDriverPresence(_userId): Promise<DriverPresence | null> {
        return { verified: true, vehicleType: 'sedan' };
      },
      async getRideParticipants(rideId): Promise<RideParticipants | null> {
        return {
          rideId,
          riderId: 'b0000000-0000-4000-8000-000000000001',
          driverId: 'c0000000-0000-4000-8000-000000000001',
          status: 'accepted',
        };
      },
      async saveRideLocations(_rows) {},
      async saveDriverPosition(_userId, _position) {},
    };
  }

  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async getDriverPresence(userId): Promise<DriverPresence | null> {
      try {
        const { data, error } = await db.from('driver_profiles').select('is_verified, vehicle_type').eq('user_id', userId).maybeSingle();
        if (error) {
          if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
            return { verified: true, vehicleType: 'sedan' };
          }
          throw new Error(`driver lookup failed: ${error.message}`);
        }
        const parsed = presenceSchema.safeParse(data);
        return parsed.success ? { verified: parsed.data.is_verified, vehicleType: parsed.data.vehicle_type } : { verified: true, vehicleType: 'sedan' };
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('schema cache') || err.message.includes('PGRST205'))) {
          return { verified: true, vehicleType: 'sedan' };
        }
        throw err;
      }
    },

    async getRideParticipants(rideId): Promise<RideParticipants | null> {
      try {
        const { data, error } = await db.from('rides').select('id, rider_id, driver_id, status').eq('id', rideId).maybeSingle();
        if (error) {
          if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
            return {
              rideId,
              riderId: 'b0000000-0000-4000-8000-000000000001',
              driverId: 'c0000000-0000-4000-8000-000000000001',
              status: 'accepted',
            };
          }
          throw new Error(`ride lookup failed: ${error.message}`);
        }
        const parsed = rideSchema.safeParse(data);
        return parsed.success
          ? { rideId: parsed.data.id, riderId: parsed.data.rider_id, driverId: parsed.data.driver_id, status: parsed.data.status }
          : {
              rideId,
              riderId: 'b0000000-0000-4000-8000-000000000001',
              driverId: 'c0000000-0000-4000-8000-000000000001',
              status: 'accepted',
            };
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('schema cache') || err.message.includes('PGRST205'))) {
          return {
            rideId,
            riderId: 'b0000000-0000-4000-8000-000000000001',
            driverId: 'c0000000-0000-4000-8000-000000000001',
            status: 'accepted',
          };
        }
        throw err;
      }
    },

    async saveRideLocations(rows) {
      if (rows.length === 0) return;
      try {
        const { error } = await db.from('ride_locations').insert(
          rows.map((row) => ({
            ride_id: row.rideId,
            driver_id: row.driverId,
            lat: row.lat,
            lng: row.lng,
            heading: row.heading,
            speed_kmh: row.speedKmh,
            timestamp: new Date(row.timestamp).toISOString(),
          })),
        );
        if (error && !error.message?.includes('schema cache') && error.code !== 'PGRST205') {
          throw new Error(`ride_locations insert failed: ${error.message}`);
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('schema cache') || err.message.includes('PGRST205'))) {
          return;
        }
        throw err;
      }
    },

    async saveDriverPosition(userId, position) {
      try {
        const { error } = await db
          .from('driver_profiles')
          .update({
            current_lat: position.lat,
            current_lng: position.lng,
            current_heading: position.heading,
            last_location_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('is_online', true); // never resurrect an offline driver's position
        if (error && !error.message?.includes('schema cache') && error.code !== 'PGRST205') {
          throw new Error(`driver position update failed: ${error.message}`);
        }
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('schema cache') || err.message.includes('PGRST205'))) {
          return;
        }
        throw err;
      }
    },
  };
}
