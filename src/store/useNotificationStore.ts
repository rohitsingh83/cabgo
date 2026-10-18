'use client';

import { create } from 'zustand';

import type { AppNotification, NotificationsPage } from '@/types';

/**
 * Notification inbox state (Zustand). Filled from GET /api/notifications, then kept current by
 * Socket.IO pushes. It is a cache — the database is the source of truth — so every action is
 * written to be idempotent (a notification may arrive both via socket and via a refetch).
 */

export type NotificationStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Cap the in-memory list so a long-lived tab can't grow without bound. */
const MAX_ITEMS = 100;

interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
  status: NotificationStatus;

  /** Replace everything with a fresh first page. */
  hydrate: (page: NotificationsPage) => void;
  /** Add an older page to the end of the list. */
  appendPage: (page: NotificationsPage) => void;
  /** A new notification arrived live. */
  receive: (notification: AppNotification) => void;
  /** Mark notifications as read locally (`all` → every one). */
  applyRead: (ids: string[], all?: boolean) => void;
  /** Overwrite the unread badge with the authoritative server count. */
  setUnreadCount: (count: number) => void;
  setStatus: (status: NotificationStatus) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  hasMore: false,
  status: 'idle',

  hydrate: (page) => set({ items: page.items, unreadCount: page.unreadCount, hasMore: page.hasMore, status: 'ready' }),

  appendPage: (page) =>
    set((state) => {
      const known = new Set(state.items.map((item) => item.id));
      const older = page.items.filter((item) => !known.has(item.id));
      return { items: [...state.items, ...older].slice(0, MAX_ITEMS), hasMore: page.hasMore, unreadCount: page.unreadCount };
    }),

  receive: (notification) =>
    set((state) => {
      if (state.items.some((item) => item.id === notification.id)) return state; // already known
      return {
        items: [notification, ...state.items].slice(0, MAX_ITEMS),
        unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
      };
    }),

  applyRead: (ids, all = false) =>
    set((state) => {
      const target = new Set(ids);
      let flipped = 0;
      const readAt = new Date().toISOString();
      const items = state.items.map((item) => {
        if (item.is_read || !(all || target.has(item.id))) return item;
        flipped += 1;
        return { ...item, is_read: true, read_at: readAt };
      });
      return { items, unreadCount: all ? 0 : Math.max(0, state.unreadCount - flipped) };
    }),

  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  setStatus: (status) => set({ status }),
  reset: () => set({ items: [], unreadCount: 0, hasMore: false, status: 'idle' }),
}));
