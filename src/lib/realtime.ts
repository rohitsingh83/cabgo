import 'server-only';

import type { RelayedEvent } from '@/lib/realtime-events';

/**
 * Bridge from the Next.js API routes to the Express + Socket.IO server.
 *
 * Business logic and database writes stay in Next.js; once a change is committed, the route
 * calls `emitRealtime` and the realtime server fans it out to the right browsers.
 * Everything here is BEST EFFORT: if the realtime server is down, slow or not configured,
 * the API request still succeeds and clients fall back to polling.
 */

export interface RealtimeEvent {
  /** Room names — build them with the `room` helpers below. */
  rooms: string[];
  event: RelayedEvent;
  payload: object;
}

export const room = {
  user: (userId: string) => `user:${userId}`,
  ride: (rideId: string) => `ride:${rideId}`,
  role: (role: 'rider' | 'driver' | 'admin') => `role:${role}`,
  onlineDrivers: 'drivers:online',
} as const;

const TIMEOUT_MS = 2500;
/** After a failure, skip the realtime server for a while so requests are not slowed down. */
const COOL_DOWN_MS = 15_000;
let unavailableUntil = 0;

function isConfigured(): boolean {
  return Boolean(process.env.REALTIME_SERVER_URL && process.env.REALTIME_INTERNAL_SECRET);
}

/** Send one or more events. Resolves to true if the realtime server accepted them. Never throws. */
export async function emitRealtime(events: RealtimeEvent | RealtimeEvent[]): Promise<boolean> {
  const list = (Array.isArray(events) ? events : [events]).filter((event) => event.rooms.length > 0);
  if (list.length === 0 || !isConfigured() || Date.now() < unavailableUntil) return false;

  try {
    // The server accepts at most 100 events per request.
    for (let index = 0; index < list.length; index += 100) {
      const response = await fetch(`${process.env.REALTIME_SERVER_URL}/realtime/emit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-secret': process.env.REALTIME_INTERNAL_SECRET ?? '',
        },
        body: JSON.stringify({ events: list.slice(index, index + 100) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`realtime server responded ${response.status}`);
    }
    return true;
  } catch (error) {
    unavailableUntil = Date.now() + COOL_DOWN_MS;
    console.warn('[realtime] emit failed (clients will fall back to polling):', error instanceof Error ? error.message : error);
    return false;
  }
}
