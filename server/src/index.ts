import { loadConfig } from './config';
import { createRealtimeServer } from './app';
import { createLogger } from './lib/logger';
import { createClerkAuthenticator } from './services/clerkAuthenticator';
import { createFirebaseLiveStore, noopLiveStore } from './services/firebaseLiveStore';
import { createSupabaseRepository } from './services/supabaseRepository';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ json: config.nodeEnv === 'production', level: config.nodeEnv === 'production' ? 'info' : 'debug' });

  const liveStore = config.firebase ? createFirebaseLiveStore(config.firebase, logger) : noopLiveStore;
  if (!config.firebase) logger.warn('Firebase is not configured — running on Socket.IO + Supabase only');

  const server = createRealtimeServer({
    config,
    logger,
    liveStore,
    repository: createSupabaseRepository(config.supabaseUrl, config.supabaseServiceRoleKey),
    authenticator: createClerkAuthenticator({
      clerkSecretKey: config.clerkSecretKey,
      supabaseUrl: config.supabaseUrl,
      supabaseServiceRoleKey: config.supabaseServiceRoleKey,
      authorizedParties: config.corsOrigins,
      logger,
    }),
  });

  const port = await server.listen(config.port);
  logger.info(`CabGo realtime server listening on :${port}`, { cors: config.corsOrigins, firebase: liveStore.enabled });

  // Graceful shutdown: flush buffered breadcrumbs, close sockets, then exit.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server
      .close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error('shutdown failed', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
