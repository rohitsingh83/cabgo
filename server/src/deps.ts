import type { AppConfig } from './config';
import type { Logger } from './lib/logger';
import type {
  DriverLocationUpdate,
  DriverPresence,
  RideLocationRow,
  RideParticipants,
  RideStatus,
  SocketUser,
  UserRole,
  VehicleType,
} from './types';

/** Verifies a browser session token and resolves it to a CabGo user. */
export interface Authenticator {
  /** Returns null for invalid/expired tokens and for unknown, suspended or not-onboarded users. */
  authenticate(token: string): Promise<SocketUser | null>;
}

/** Database access needed by the realtime layer (implemented with Supabase). */
export interface Repository {
  getDriverPresence(userId: string): Promise<DriverPresence | null>;
  getRideParticipants(rideId: string): Promise<RideParticipants | null>;
  /** Bulk insert into `ride_locations` (the permanent breadcrumb trail). */
  saveRideLocations(rows: RideLocationRow[]): Promise<void>;
  /** Persist the driver's last known position on `driver_profiles`. */
  saveDriverPosition(userId: string, position: { lat: number; lng: number; heading: number }): Promise<void>;
}

/** Firebase Realtime Database mirror (implemented with firebase-admin; no-op when unconfigured). */
export interface LiveStore {
  readonly enabled: boolean;
  setDriverLocation(update: DriverLocationUpdate, vehicleType: VehicleType | null): Promise<void>;
  removeDriver(driverId: string): Promise<void>;
  setRideLocation(update: DriverLocationUpdate): Promise<void>;
  appendTrail(rideId: string, point: { lat: number; lng: number; t: number }): Promise<void>;
  /** `participantIds` (rider + driver user ids) are recorded so the security rules can limit reads to them. */
  setRideStatus(rideId: string, status: RideStatus, participantIds: string[]): Promise<void>;
  clearRide(rideId: string): Promise<void>;
  /** Custom token so the browser can sign into Firebase with its CabGo user id as uid. */
  issueToken(userId: string, role: UserRole): Promise<string | null>;
}

export interface Deps {
  config: Pick<AppConfig, 'nodeEnv' | 'corsOrigins' | 'internalSecret'>;
  authenticator: Authenticator;
  repository: Repository;
  liveStore: LiveStore;
  logger: Logger;
}
