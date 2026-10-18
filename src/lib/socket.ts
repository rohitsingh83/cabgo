import { io, type Socket } from 'socket.io-client';

import { SOCKET_URL } from '@/lib/constants';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Creates (but does not connect) the browser socket.
 *
 * The auth callback runs on EVERY (re)connect attempt and fetches a fresh Clerk session token —
 * Clerk tokens live ~60 s, so a token captured once would fail the first time the connection
 * dropped and came back.
 */
export function createAppSocket(getToken: () => Promise<string | null>): AppSocket {
  return io(SOCKET_URL, {
    autoConnect: false,
    // WebSocket first; long-polling remains as the fallback for restrictive networks.
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15_000,
    auth: (callback) => {
      getToken()
        .then((token) => callback({ token: token ?? '' }))
        .catch(() => callback({ token: '' }));
    },
  });
}
