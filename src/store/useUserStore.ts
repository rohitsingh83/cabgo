'use client';

import { create } from 'zustand';

import type { ApiResponse, User, UserRole } from '@/types';

/**
 * Global user state (Zustand).
 *
 * The source of identity is Clerk; this store holds the *application* profile (role, phone,
 * avatar …) from Supabase so any component can read it synchronously. It is hydrated by
 * <UserSync /> and cleared on sign-out. Nothing here is persisted to storage.
 */

export type UserStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UserState {
  user: User | null;
  status: UserStatus;
  error: string | null;

  /** Load (or reload) the profile from /api/users/me. Concurrent calls share one request. */
  fetchUser: (options?: { force?: boolean }) => Promise<User | null>;
  /** Replace the profile (e.g. after a PATCH response). */
  setUser: (user: User | null) => void;
  /** Optimistically merge fields into the cached profile. */
  patchUser: (changes: Partial<User>) => void;
  /** Clear everything (sign-out). */
  reset: () => void;
}

let inflight: Promise<User | null> | null = null;

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  fetchUser: async ({ force = false } = {}) => {
    const { user, status } = get();
    if (!force && user && status === 'ready') return user;
    if (inflight) return inflight;

    set({ status: 'loading', error: null });

    inflight = (async () => {
      try {
        const response = await fetch('/api/users/me', { cache: 'no-store' });
        const body = (await response.json()) as ApiResponse<User>;
        if (!response.ok || !body.success) {
          throw new Error(body.success ? 'Failed to load profile' : body.error);
        }
        set({ user: body.data, status: 'ready', error: null });
        return body.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load profile';
        set({ status: 'error', error: message });
        return null;
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  },

  setUser: (user) => set({ user, status: user ? 'ready' : 'idle', error: null }),

  patchUser: (changes) => {
    const { user } = get();
    if (user) set({ user: { ...user, ...changes } });
  },

  reset: () => {
    inflight = null;
    set({ user: null, status: 'idle', error: null });
  },
}));

/* Selectors — subscribe to the smallest slice to avoid needless re-renders. */
export const selectUser = (state: UserState): User | null => state.user;
export const selectRole = (state: UserState): UserRole | null => state.user?.role ?? null;
export const selectIsLoading = (state: UserState): boolean =>
  state.status === 'idle' || state.status === 'loading';
