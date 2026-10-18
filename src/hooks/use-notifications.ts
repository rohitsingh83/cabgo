'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { toast } from '@/components/ui/use-toast';
import { useRealtime, useSocketEvent } from '@/hooks/use-realtime';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { useNotificationStore } from '@/store/useNotificationStore';
import type { AppNotification, NotificationsPage } from '@/types';

const PAGE_SIZE = 20;
/** Safety-net refresh while the socket is down. */
const POLL_MS = 60_000;

/**
 * Loads the inbox, keeps it live and exposes the actions the bell needs.
 * Mount it ONCE (the NotificationBell does) — it owns the socket listeners and toasts.
 */
export function useNotifications() {
  const pathname = usePathname();
  const { status: socketStatus } = useRealtime();
  const socketUp = socketStatus === 'connected';
  const store = useNotificationStore();
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const load = useCallback(async () => {
    const { setStatus, hydrate, status } = useNotificationStore.getState();
    if (status !== 'ready') setStatus('loading');
    try {
      const page = await apiFetch<NotificationsPage>(`/api/notifications?limit=${PAGE_SIZE}`);
      hydrate(page);
      setError(null);
    } catch (failure) {
      // Keep showing what we have if a background refresh fails.
      if (useNotificationStore.getState().status !== 'ready') setStatus('error');
      setError(failure instanceof ApiClientError ? failure.message : 'Could not load notifications.');
    }
  }, []);

  // First load, and a reload after every (re)connect to fill any gap while the socket was away.
  useEffect(() => {
    void load();
  }, [load, socketUp]);

  // Fallback polling while realtime is unavailable.
  useEffect(() => {
    if (socketUp) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [socketUp, load]);

  /* ----- live pushes ----- */
  useSocketEvent('notification', (notification: AppNotification) => {
    useNotificationStore.getState().receive(notification);
    if (!shouldToast(notification, pathnameRef.current)) return;
    toast({ title: notification.title, description: notification.message });
  });
  useSocketEvent('notification:read', ({ ids, all }) => useNotificationStore.getState().applyRead(ids, all));

  /* ----- actions ----- */
  const loadMore = useCallback(async () => {
    const { items, hasMore, appendPage } = useNotificationStore.getState();
    const last = items[items.length - 1];
    if (!hasMore || !last) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<NotificationsPage>(
        `/api/notifications?limit=${PAGE_SIZE}&before=${encodeURIComponent(last.created_at)}`,
      );
      appendPage(page);
    } catch {
      toast({ variant: 'destructive', title: 'Could not load older notifications' });
    } finally {
      setLoadingMore(false);
    }
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    const state = useNotificationStore.getState();
    const unread = ids.filter((id) => state.items.some((item) => item.id === id && !item.is_read));
    if (unread.length === 0) return;
    state.applyRead(unread); // optimistic
    try {
      const result = await apiFetch<{ unreadCount: number }>('/api/notifications', { method: 'PATCH', body: { ids: unread } });
      useNotificationStore.getState().setUnreadCount(result.unreadCount);
    } catch {
      void load(); // roll back to the server's truth
    }
  }, [load]);

  const markAllRead = useCallback(async () => {
    useNotificationStore.getState().applyRead([], true); // optimistic
    try {
      await apiFetch('/api/notifications', { method: 'PATCH', body: { all: true } });
    } catch {
      toast({ variant: 'destructive', title: 'Could not mark all as read' });
      void load();
    }
  }, [load]);

  return { ...store, loadingMore, error, reload: load, loadMore, markRead, markAllRead };
}

/** Skip toasts that would duplicate something the current screen already shows. */
function shouldToast(notification: AppNotification, pathname: string): boolean {
  // The driver console announces new requests itself.
  if (notification.type === 'ride_requested' && pathname === '/driver') return false;
  // The ride tracker already toasts every status change of the ride being watched.
  const rideId = typeof notification.data.rideId === 'string' ? notification.data.rideId : null;
  if (rideId && pathname === `/rider/tracking/${rideId}`) return false;
  return document.visibilityState === 'visible';
}
