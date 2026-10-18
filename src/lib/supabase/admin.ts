import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types';

export type TypedSupabaseAdminClient = SupabaseClient<Database>;

let adminClient: TypedSupabaseAdminClient | null = null;

/**
 * Service-role Supabase client. BYPASSES Row Level Security — only use it in
 * server code (API routes, webhooks) AFTER you have authenticated and authorised
 * the caller yourself. Never import this from a Client Component
 * (`server-only` makes the build fail if you do).
 */
import { MockSupabaseClient } from '@/lib/demo/mock-db';

export function createSupabaseAdminClient(): TypedSupabaseAdminClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Gracefully fallback to the rich in-memory demo database if keys are placeholders or unset
  if (!url || !serviceKey || url.includes('your-project-ref') || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return new MockSupabaseClient() as unknown as TypedSupabaseAdminClient;
  }

  adminClient = createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      // Next.js 14 caches fetch() by default — make sure DB reads are always fresh.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });

  return adminClient;
}
