import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

import type { Deps } from '../deps';
import { LocationBuffer } from '../services/locationBuffer';
import { rooms, type ClientToServerEvents, type ServerToClientEvents, type SocketData } from '../types';
import { TtlCache } from '../utils/ttlCache';
import { Presence, type RealtimeContext, type RealtimeServer } from './context';
import { registerDriverHandlers } from './driverHandlers';
import { registerRideHandlers } from './rideHandlers';

const MAX_SOCKETS_PER_USER = 8;

export interface SocketLayer {
  io: RealtimeServer;
  ctx: RealtimeContext;
  /** Flush buffers and disconnect everyone (graceful shutdown). */
  shutdown(): Promise<void>;
}

/**
 * Creates the Socket.IO server on top of the HTTP server.
 *
 * Rooms
 *   user:{id}      every socket of a user (notifications, ride updates)
 *   role:{role}    all users with a role (e.g. admins receive SOS alerts)
 *   drivers:online drivers that toggled online (broadcast "ride taken / cancelled")
 *   ride:{id}      participants of one ride (live driver location)
 */
export function attachSocketServer(httpServer: HttpServer, deps: Deps): SocketLayer {
  const io: RealtimeServer = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: deps.config.corsOrigins, credentials: true },
    // Detect dead mobile connections within ~40 s.
    pingInterval: 20_000,
    pingTimeout: 20_000,
    // GPS payloads are tiny; anything bigger is abuse.
    maxHttpBufferSize: 16 * 1024,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: false },
  });

  const buffer = new LocationBuffer(deps.repository, deps.logger);
  buffer.start();

  const ctx: RealtimeContext = {
    io,
    deps,
    presence: new Presence(),
    buffer,
    latestLocations: new Map(),
    rideCache: new TtlCache(15_000),
  };

  // ---- authentication: runs once per connection attempt --------------------------------
  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
      return next(new Error('UNAUTHORIZED'));
    }
    try {
      const user = await deps.authenticator.authenticate(token);
      if (!user) return next(new Error('UNAUTHORIZED'));
      if (ctx.presence.count(user.id) >= MAX_SOCKETS_PER_USER) return next(new Error('TOO_MANY_CONNECTIONS'));
      socket.data.user = user;
      return next();
    } catch (error) {
      deps.logger.error('socket auth failed', { error: error instanceof Error ? error.message : String(error) });
      return next(new Error('AUTH_UNAVAILABLE'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    ctx.presence.add(user.id, socket.id);
    void socket.join([rooms.user(user.id), rooms.role(user.role)]);
    deps.logger.debug('socket connected', { userId: user.id, role: user.role });

    // Registered BEFORE the feature handlers: their disconnect hooks rely on an up-to-date presence count.
    socket.on('disconnect', () => {
      ctx.presence.remove(user.id, socket.id);
    });

    registerRideHandlers(ctx, socket);
    registerDriverHandlers(ctx, socket);
  });

  return {
    io,
    ctx,
    async shutdown() {
      await buffer.stop();
      await io.close();
    },
  };
}
