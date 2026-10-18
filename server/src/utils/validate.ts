import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const latSchema = z.number().finite().min(-90).max(90);
export const lngSchema = z.number().finite().min(-180).max(180);

/** GPS sample from a driver's device. Identity and timestamp are NEVER taken from the client. */
export const driverLocationSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  heading: z.number().finite().default(0).transform((value) => ((value % 360) + 360) % 360),
  speedKmh: z.number().finite().min(0).max(250).default(0),
  rideId: uuidSchema.optional(),
});

export const driverOnlineSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  vehicleType: z.enum(['bike', 'auto', 'sedan', 'suv']).optional(),
});

export const rideRoomSchema = z.object({ rideId: uuidSchema });
