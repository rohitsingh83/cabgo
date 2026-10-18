import 'server-only';

/**
 * Fixed-window rate limiter for API routes.
 *
 *  • With `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set, counters live in Redis, so the limit is
 *    shared by every serverless instance (this is what you want on Vercel).
 *  • Without them, counters live in this process's memory. That is still useful against a single abusive
 *    client hammering one instance, but each instance counts separately, so treat it as a safety net.
 *  • Fail-open: if Redis is unreachable the request is counted in memory instead of being rejected —
 *    a rate-limiter outage must never take the app down.
 */

export interface RateLimitRule {
  /** Bucket name — separate buckets never share a counter (e.g. "read", "write", "payments"). */
  name: string;
  /** Maximum requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSec: number;
}

/** Defaults: generous for the polling the UI does (≤ ~40 reads/min), tight enough to stop scripts. */
export const RATE_LIMITS = {
  read: { name: 'read', limit: 180, windowSec: 60 },
  write: { name: 'write', limit: 60, windowSec: 60 },
  /** Anything that talks to Stripe or moves money. */
  payments: { name: 'payments', limit: 12, windowSec: 60 },
  /** SOS can legitimately be pressed repeatedly in a panic, but not hundreds of times. */
  sos: { name: 'sos', limit: 10, windowSec: 60 },
  /** File uploads (avatars, driver documents). */
  upload: { name: 'upload', limit: 15, windowSec: 60 },
  /** Promo-code guessing. */
  promo: { name: 'promo', limit: 20, windowSec: 60 },
  /** Routes that call paid Google Maps APIs (fare estimates, geocoding). */
  maps: { name: 'maps', limit: 60, windowSec: 60 },
  /** Creating tickets / ratings / onboarding — human-speed actions. */
  content: { name: 'content', limit: 20, windowSec: 300 },
} as const satisfies Record<string, RateLimitRule>;

/* ---------------------------------------------------------------------- */
/* In-memory backend                                                       */
/* ---------------------------------------------------------------------- */

interface Counter {
  count: number;
  resetAt: number;
}

const memory = new Map<string, Counter>();
const MAX_MEMORY_KEYS = 10_000;

function hitMemory(key: string, windowSec: number, now: number): Counter {
  // Opportunistic cleanup keeps the map bounded without a timer (timers keep serverless processes alive).
  if (memory.size > MAX_MEMORY_KEYS) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    // Still too big (a flood of unique keys inside one window): drop the oldest entries.
    if (memory.size > MAX_MEMORY_KEYS) {
      for (const k of memory.keys()) {
        memory.delete(k);
        if (memory.size <= MAX_MEMORY_KEYS / 2) break;
      }
    }
  }
  const current = memory.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowSec * 1000 };
    memory.set(key, fresh);
    return fresh;
  }
  current.count += 1;
  return current;
}

/* ---------------------------------------------------------------------- */
/* Upstash Redis (REST) backend                                            */
/* ---------------------------------------------------------------------- */

const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN;

export function isRedisRateLimitConfigured(): boolean {
  return Boolean(redisUrl() && redisToken());
}

/** INCR + EXPIRE NX + TTL in one round trip. Returns null when Redis is unavailable. */
async function hitRedis(key: string, windowSec: number): Promise<{ count: number; ttl: number } | null> {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) return null;
  try {
    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
        ['TTL', key],
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return null;
    const results = (await response.json()) as { result?: number; error?: string }[];
    const count = results[0]?.result;
    const ttl = results[2]?.result;
    if (typeof count !== 'number' || typeof ttl !== 'number') return null;
    return { count, ttl: ttl > 0 ? ttl : windowSec };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------- */
/* Public API                                                              */
/* ---------------------------------------------------------------------- */

/** Count one request for `identity` against `rule`. */
export async function checkRateLimit(identity: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const key = `cabgo:rl:${rule.name}:${identity}`;
  const now = Date.now();

  const redis = await hitRedis(key, rule.windowSec);
  const count = redis?.count ?? hitMemory(key, rule.windowSec, now).count;
  const retryAfterSec = redis ? redis.ttl : Math.max(1, Math.ceil(((memory.get(key)?.resetAt ?? now) - now) / 1000));

  return { allowed: count <= rule.limit, limit: rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterSec };
}

/**
 * Who is making the request: the signed-in user when there is one (so users behind one office / mobile-carrier
 * NAT don't share a budget), otherwise the client IP.
 */
export function clientIdentity(request: Request, userId: string | null): string {
  if (userId) return `u:${userId}`;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `ip:${forwarded || request.headers.get('x-real-ip') || 'unknown'}`;
}

/** Test helper. */
export function resetRateLimits(): void {
  memory.clear();
}
