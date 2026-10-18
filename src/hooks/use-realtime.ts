'use client';

import { useContext, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';

import { RealtimeContext, type RealtimeContextValue } from '@/components/providers/RealtimeProvider';
import type { ServerToClientEvents } from '@/types';

/** The shared socket + connection status. Safe to call outside the provider (returns offline). */
export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/**
 * Subscribe to a server event for the lifetime of the component.
 * The latest `handler` is always called (kept in a ref), so callers don't need useCallback and
 * the listener is not torn down on every render.
 */
export function useSocketEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: ServerToClientEvents[E],
  enabled = true,
): void {
  const { socket } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket || !enabled) return;
    // The typed socket can't express "event name is a type parameter", so use the untyped view.
    const untyped = socket as unknown as Socket;
    const listener = (...args: unknown[]) => (handlerRef.current as (...a: unknown[]) => void)(...args);
    untyped.on(event as string, listener);
    return () => {
      untyped.off(event as string, listener);
    };
  }, [socket, event, enabled]);
}
