import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { createServer, type Server as HttpServer } from 'http';

import type { Deps } from './deps';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { requireInternalSecret } from './middleware/internalAuth';
import { httpRateLimit } from './middleware/rateLimit';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';
import { createRealtimeRouter } from './routes/realtime';
import { attachSocketServer, type SocketLayer } from './socket';

export interface RealtimeServer {
  app: Express;
  httpServer: HttpServer;
  layer: SocketLayer;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

/**
 * Composition root. All I/O (Clerk, Supabase, Firebase) comes in through `deps`, so tests can
 * run the full HTTP + WebSocket stack with in-memory fakes.
 */
export function createRealtimeServer(deps: Deps): RealtimeServer {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Railway/Render terminate TLS in front of us

  app.use(helmet());
  app.use(cors({ origin: deps.config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '256kb' }));

  const httpServer = createServer(app);
  const layer = attachSocketServer(httpServer, deps);

  const publicLimit = httpRateLimit({ windowMs: 60_000, max: 60 });
  const internalLimit = httpRateLimit({ windowMs: 60_000, max: 3000 });

  app.get('/', (_request, response) => {
    response.json({ name: 'cabgo-realtime', status: 'ok' });
  });
  app.use('/health', createHealthRouter(layer, deps.liveStore.enabled));
  app.use('/auth', publicLimit, createAuthRouter(deps));
  app.use('/realtime', internalLimit, requireInternalSecret(deps.config.internalSecret), createRealtimeRouter(layer, deps));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return {
    app,
    httpServer,
    layer,
    listen: (port) =>
      new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, () => {
          const address = httpServer.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      }),
    async close() {
      publicLimit.limiter.dispose();
      internalLimit.limiter.dispose();
      await layer.shutdown();
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    },
  };
}
