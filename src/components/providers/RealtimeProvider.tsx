'use client';

import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/clerk-client';

import { createAppSocket, type AppSocket } from '@/lib/socket';

export type ConnectionStatus = 'connecting' | 'connected' | 'offline';

export interface RealtimeContextValue {
  /** Null until the signed-in user's socket has been created. */
  socket: AppSocket | null;
  status: ConnectionStatus;
}

export const RealtimeContext = createContext<RealtimeContextValue>({ socket: null, status: 'offline' });

/**
 * Owns the single Socket.IO connection for the dashboard.
 *
 * Realtime is an ENHANCEMENT: every screen also polls the REST API, so when the socket is
 * unavailable (server down, blocked network) the app keeps working, just with a few seconds of delay.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    if (!isSignedIn && !isDemo) return;

    const tokenGetter = async (): Promise<string | null> => {
      if (isSignedIn) {
        return await getTokenRef.current();
      }
      if (isDemo) {
        const match = typeof document !== 'undefined' ? document.cookie.match(/cabgo_demo_role=([^;]+)/) : null;
        const role = match && match[1] ? match[1].trim() : 'rider';
        return `demo-token:${role}`;
      }
      return null;
    };

    const instance = createAppSocket(tokenGetter);
    setSocket(instance);
    setStatus('connecting');

    instance.on('connect', () => setStatus('connected'));
    instance.on('disconnect', () => setStatus('connecting'));
    instance.on('connect_error', () => {
      // `active` stays true while socket.io is retrying by itself; false means it gave up
      // (e.g. the server rejected our token) and we must reconnect manually.
      setStatus(instance.active ? 'connecting' : 'offline');
    });
    instance.connect();

    // Wake the connection when the user comes back to the tab or the network returns.
    const wake = () => {
      if (document.visibilityState === 'visible' && !instance.connected && !instance.active) instance.connect();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);

    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      instance.removeAllListeners();
      instance.disconnect();
      setSocket(null);
    };
  }, [isSignedIn]);

  const value = useMemo<RealtimeContextValue>(() => ({ socket, status }), [socket, status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
