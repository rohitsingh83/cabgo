export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Minimal structured logger: JSON lines in production (parsed by Railway/Render log viewers),
 * readable text in development. Intentionally dependency-free.
 */
export function createLogger(options: { json: boolean; level?: Level }): Logger {
  const threshold = ORDER[options.level ?? 'info'];

  const write = (level: Level, message: string, meta?: Record<string, unknown>) => {
    if (ORDER[level] < threshold) return;
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (options.json) {
      sink(JSON.stringify({ level, time: new Date().toISOString(), message, ...meta }));
    } else {
      sink(`[${level.toUpperCase().padEnd(5)}] ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`);
    }
  };

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}

/** Logger that discards everything (used by tests). */
export const silentLogger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };
