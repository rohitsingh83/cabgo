import type { Server, Socket } from 'socket.io';

import type { Deps } from '../deps';
import type { LocationBuffer } from '../services/locationBuffer';
import type {
  ClientToServerEvents,
  DriverLocationUpdate,
  RideParticipants,
  ServerToClientEvents,
  SocketData,
} from '../types';
import { TtlCache } from '../utils/ttlCache';

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Tracks which users have live sockets (a user can be connected from several devices). */
export class Presence {
  private readonly sockets = new Map<string, Set<string>>();

  add(userId: string, socketId: string): number {
    const set = this.sockets.get(userId) ?? new Set<string>();
    set.add(socketId);
    this.sockets.set(userId, set);
    return set.size;
  }

  remove(userId: string, socketId: string): number {
    const set = this.sockets.get(userId);
    if (!set) return 0;
    set.delete(socketId);
    if (set.size === 0) this.sockets.delete(userId);
    return set.size;
  }

  count(userId: string): number {
    return this.sockets.get(userId)?.size ?? 0;
  }

  get users(): number {
    return this.sockets.size;
  }
}

/** Everything the socket handlers share. One instance per server. */
export interface RealtimeContext {
  io: RealtimeServer;
  deps: Deps;
  presence: Presence;
  buffer: LocationBuffer;
  /** Last GPS sample per ride, replayed to anyone who joins the ride room late. */
  latestLocations: Map<string, DriverLocationUpdate>;
  /** Short-lived ride lookups so a 1 Hz GPS stream does not hit Postgres every second. */
  rideCache: TtlCache<RideParticipants | null>;
}

/** Cached ride lookup (15 s). `invalidateRide` is called whenever the ride's state changes. */
export async function getRide(ctx: RealtimeContext, rideId: string): Promise<RideParticipants | null> {
  const cached = ctx.rideCache.get(rideId);
  if (cached !== undefined) return cached;
  const ride = await ctx.deps.repository.getRideParticipants(rideId);
  ctx.rideCache.set(rideId, ride);
  return ride;
}

export function invalidateRide(ctx: RealtimeContext, rideId: string): void {
  ctx.rideCache.delete(rideId);
}
