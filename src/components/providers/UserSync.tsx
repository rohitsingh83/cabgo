'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/clerk-client';

import { useUserStore } from '@/store/useUserStore';

/**
 * Renders nothing. Keeps the Zustand user store in step with the Clerk session:
 * signed in → load the Supabase profile, signed out (or account switch) → clear it.
 */
export function UserSync() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const fetchUser = useUserStore((state) => state.fetchUser);
  const reset = useUserStore((state) => state.reset);
  const cachedClerkId = useUserStore((state) => state.user?.clerk_id ?? null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        void fetchUser();
        return;
      }
      reset();
      return;
    }

    // Switched accounts without a full reload? Drop the stale profile first.
    if (cachedClerkId && cachedClerkId !== userId) reset();
    void fetchUser();
  }, [isLoaded, isSignedIn, userId, cachedClerkId, fetchUser, reset]);

  return null;
}
