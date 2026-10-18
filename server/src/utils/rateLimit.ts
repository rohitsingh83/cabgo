/**
 * Sliding-window limiter keyed by an arbitrary string (IP address, user id …).
 * In-memory: fine for a single instance. If you scale the server horizontally, move this
 * to Redis (and add the Socket.IO Redis adapter) — see the README deployment notes.
 */
export interface RateLimiter {
  /** Returns true when the call is allowed and records it. */
  take(key: string): boolean;
  /** Stops the cleanup timer. */
  dispose(): void;
}

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, number[]>();

  // Drop idle keys so the map cannot grow without bound.
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - options.windowMs;
    for (const [key, stamps] of hits) {
      const fresh = stamps.filter((stamp) => stamp > cutoff);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, Math.max(options.windowMs, 10_000));
  cleanup.unref();

  return {
    take(key) {
      const now = Date.now();
      const cutoff = now - options.windowMs;
      const stamps = (hits.get(key) ?? []).filter((stamp) => stamp > cutoff);
      if (stamps.length >= options.max) {
        hits.set(key, stamps);
        return false;
      }
      stamps.push(now);
      hits.set(key, stamps);
      return true;
    },
    dispose() {
      clearInterval(cleanup);
      hits.clear();
    },
  };
}

/** Allows one call per `intervalMs` per key (used to throttle GPS streams). */
export function createIntervalGate(intervalMs: number) {
  const last = new Map<string, number>();
  return {
    allow(key: string, now = Date.now()): boolean {
      const previous = last.get(key);
      if (previous !== undefined && now - previous < intervalMs) return false;
      last.set(key, now);
      return true;
    },
    forget(key: string) {
      last.delete(key);
    },
  };
}
