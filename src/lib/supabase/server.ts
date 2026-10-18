import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types';

export type TypedSupabaseClient = SupabaseClient<Database>;

const CLERK_TEMPLATE = process.env.NEXT_PUBLIC_CLERK_SUPABASE_JWT_TEMPLATE;

/**
 * Supabase client for Server Components / Route Handlers that acts AS THE
 * SIGNED-IN USER (Row Level Security applies). Use `createSupabaseAdminClient`
 * from ./admin for privileged operations.
 *
 * Must be called inside a request scope (it reads the Clerk session).
 */
import { MockSupabaseClient } from '@/lib/demo/mock-db';

export function createSupabaseServerClient(): TypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('your-project-ref') || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return new MockSupabaseClient() as unknown as TypedSupabaseClient;
  }

  const { getToken } = auth();

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const token = await getToken(CLERK_TEMPLATE ? { template: CLERK_TEMPLATE } : undefined);
        const headers = new Headers(init?.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers, cache: 'no-store' });
      },
    },
  });
}
