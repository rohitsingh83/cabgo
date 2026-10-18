import { Router } from 'express';

import type { SocketLayer } from '../socket';

/** Liveness/readiness probe for Railway/Render, plus a few counters for debugging. */
export function createHealthRouter(layer: SocketLayer, firebaseEnabled: boolean): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      connections: layer.io.engine.clientsCount,
      users: layer.ctx.presence.users,
      pendingLocationRows: layer.ctx.buffer.size,
      firebase: firebaseEnabled,
    });
  });

  return router;
}
