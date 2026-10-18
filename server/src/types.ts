/**
 * Types shared inside the realtime server.
 *
 * The Socket.IO event contracts mirror `src/types/index.ts` in the Next.js app. They are
 * duplicated on purpose: `/server` is deployed on its own (Railway/Render, root dir `/server`)
 * and must not import from outside its folder.
 */

export type UserRole = 'rider' | 'driver' | 'admin';
export type VehicleType = 'bike' | 'auto' | 'sedan' | 'suv';
export type RideStatus =
  | 'requested'
  | 'searching'
  | 'accepted'
  | 'driver_arriving'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** Rides in these states have a driver who is expected to stream GPS. */
export const LIVE_RIDE_STATUSES: readonly RideStatus[] = ['accepted', 'driver_arriving', 'in_progress'];
export const TERMINAL_RIDE_STATUSES: readonly RideStatus[] = ['completed', 'cancelled'];

export interface LatLng {
  lat: number;
  lng: number;
}

/** The authenticated identity attached to every socket / HTTP request. */
export interface SocketUser {
  /** users.id (UUID) — NOT the Clerk id. */
  id: string;
  clerkId: string;
  role: UserRole;
  fullName: string;
}

export interface DriverLocationUpdate extends LatLng {
  rideId?: string;
  driverId: string;
  heading: number;
  speedKmh: number;
  /** Epoch ms, stamped by the server. */
  timestamp: number;
}

/** Inbound GPS sample from a driver's device (identity + time are added server-side). */
export interface DriverLocationInput extends LatLng {
  rideId?: string;
  heading: number;
  speedKmh: number;
}

export interface RideParticipants {
  rideId: string;
  riderId: string;
  driverId: string | null;
  status: RideStatus;
}

export interface DriverPresence {
  verified: boolean;
  vehicleType: VehicleType;
}

export interface RideLocationRow {
  rideId: string;
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  /** Epoch ms. */
  timestamp: number;
}

/** JSON object relayed untouched from the Next.js app to browsers. */
export type RelayPayload = Record<string, unknown>;

export interface RideStatusPayload {
  rideId: string;
  status: RideStatus;
  driverId?: string | null;
  at: string;
  reason?: string | null;
}

/* ---- Socket.IO contracts ------------------------------------------------ */

/** Events the Next.js app may ask this server to deliver (see routes/realtime.ts). */
export const RELAYED_EVENTS = [
  'notification',
  'notification:read',
  'ride:request',
  'ride:request:expired',
  'ride:taken',
  'ride:accepted',
  'ride:status',
  'ride:cancelled',
  'ride:no-drivers',
  'sos:alert',
] as const;
export type RelayedEvent = (typeof RELAYED_EVENTS)[number];

export interface ServerToClientEvents {
  notification: (payload: RelayPayload) => void;
  'notification:read': (payload: { ids: string[]; all?: boolean }) => void;
  'ride:request': (payload: RelayPayload) => void;
  'ride:request:expired': (payload: { rideId: string }) => void;
  'ride:taken': (payload: { rideId: string }) => void;
  'ride:accepted': (payload: RideStatusPayload) => void;
  'ride:status': (payload: RideStatusPayload) => void;
  'ride:cancelled': (payload: RideStatusPayload) => void;
  'ride:no-drivers': (payload: { rideId: string }) => void;
  'driver:location': (payload: DriverLocationUpdate) => void;
  'sos:alert': (payload: RelayPayload) => void;
  'socket:error': (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  'ride:join': (payload: { rideId: string }, ack?: (ok: boolean) => void) => void;
  'ride:leave': (payload: { rideId: string }) => void;
  'driver:online': (payload: LatLng & { vehicleType?: VehicleType }) => void;
  'driver:offline': () => void;
  'driver:location:update': (payload: DriverLocationInput) => void;
}

export interface SocketData {
  user: SocketUser;
}

/* ---- Rooms -------------------------------------------------------------- */

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  ride: (rideId: string) => `ride:${rideId}`,
  role: (role: UserRole) => `role:${role}`,
  /** Every driver that is currently online (receives broadcast ride events). */
  onlineDrivers: 'drivers:online',
} as const;
