'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth/clerk-client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types';

export type TypedSupabaseClient = SupabaseClient<Database>;

/** Optional Clerk JWT template (legacy integration). Leave unset for Clerk's native Supabase integration. */
const CLERK_TEMPLATE = process.env.NEXT_PUBLIC_CLERK_SUPABASE_JWT_TEMPLATE;

type TokenGetter = () => Promise<string | null>;

/**
 * Creates a browser Supabase client that authenticates every request with the
 * caller's Clerk session token. Supabase Auth itself is NOT used (no cookies,
 * no refresh timers) — Clerk is the single source of identity.
 */
export function createSupabaseBrowserClient(getToken: TokenGetter): TypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      // Inject the Clerk token on each request (tokens are short-lived, so fetch lazily).
      fetch: async (input, init) => {
        const token = await getToken();
        const headers = new Headers(init?.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/**
 * React hook returning a stable, Clerk-authenticated Supabase client.
 *
 * ```tsx
 * const supabase = useSupabase();
 * const { data } = await supabase.from('rides').select('*').eq('rider_id', userId);
 * ```
 */
export function useSupabase(): TypedSupabaseClient {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const client = useMemo(
    () =>
      createSupabaseBrowserClient(() =>
        getTokenRef.current(CLERK_TEMPLATE ? { template: CLERK_TEMPLATE } : undefined),
      ),
    [],
  );

  // Realtime (websocket) connections need the token too — keep it fresh.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const token = await getTokenRef.current(CLERK_TEMPLATE ? { template: CLERK_TEMPLATE } : undefined);
      if (!cancelled && token) client.realtime.setAuth(token);
    };
    void refresh();
    const interval = setInterval(refresh, 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client]);

  return client;
}
