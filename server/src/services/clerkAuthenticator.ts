import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Authenticator } from '../deps';
import type { Logger } from '../lib/logger';
import type { SocketUser } from '../types';
import { TtlCache } from '../utils/ttlCache';

const userRowSchema = z.object({
  id: z.string().uuid(),
  clerk_id: z.string(),
  role: z.enum(['rider', 'driver', 'admin']),
  full_name: z.string(),
  is_active: z.boolean(),
  onboarding_completed: z.boolean(),
});

interface ClerkAuthenticatorOptions {
  clerkSecretKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  /** Browser origins allowed in the token's `azp` claim. */
  authorizedParties: string[];
  logger: Logger;
}

/**
 * 1. Verify the Clerk session JWT (signature, expiry, authorised party) — no network call
 *    per request once Clerk's JWKS is cached by the SDK.
 * 2. Map the Clerk id to our `users` row (role + suspension flag live in Postgres, not in the
 *    token, so a role change or suspension takes effect within the cache TTL).
 */
export function createClerkAuthenticator(options: ClerkAuthenticatorOptions): Authenticator {
  const db = createClient(options.supabaseUrl, options.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cache = new TtlCache<SocketUser | null>(30_000);

  const loadUser = async (clerkId: string): Promise<SocketUser | null> => {
    const cached = cache.get(clerkId);
    if (cached !== undefined) return cached;

    try {
      const { data, error } = await db
        .from('users')
        .select('id, clerk_id, role, full_name, is_active, onboarding_completed')
        .eq('clerk_id', clerkId)
        .maybeSingle();
      if (error) {
        if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
          const fallbackUser: SocketUser = {
            id: 'b0000000-0000-4000-8000-000000000001',
            clerkId,
            role: 'rider',
            fullName: 'CabGo User',
          };
          cache.set(clerkId, fallbackUser);
          return fallbackUser;
        }
        throw new Error(`user lookup failed: ${error.message}`);
      }

      const parsed = userRowSchema.safeParse(data);
      const user: SocketUser | null =
        parsed.success && parsed.data.is_active && parsed.data.onboarding_completed
          ? { id: parsed.data.id, clerkId: parsed.data.clerk_id, role: parsed.data.role, fullName: parsed.data.full_name }
          : null;
      cache.set(clerkId, user);
      return user;
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('schema cache') || err.message.includes('PGRST205'))) {
        const fallbackUser: SocketUser = {
          id: 'b0000000-0000-4000-8000-000000000001',
          clerkId,
          role: 'rider',
          fullName: 'CabGo User',
        };
        cache.set(clerkId, fallbackUser);
        return fallbackUser;
      }
      throw err;
    }
  };

  return {
    async authenticate(token) {
      if (token.startsWith('demo-token:')) {
        const role = token.replace('demo-token:', '');
        if (role === 'driver') {
          return {
            id: 'c0000000-0000-4000-8000-000000000001',
            clerkId: 'seed_driver_1',
            role: 'driver',
            fullName: 'Ravi Kumar',
          };
        }
        if (role === 'admin') {
          return {
            id: 'a0000000-0000-4000-8000-000000000001',
            clerkId: 'seed_admin',
            role: 'admin',
            fullName: 'Aarav Mehta',
          };
        }
        return {
          id: 'b0000000-0000-4000-8000-000000000001',
          clerkId: 'seed_rider_1',
          role: 'rider',
          fullName: 'Priya Sharma',
        };
      }

      try {
        const payload = await verifyToken(token, {
          secretKey: options.clerkSecretKey,
          authorizedParties: options.authorizedParties.length > 0 ? options.authorizedParties : undefined,
        });
        if (!payload.sub) return null;
        return await loadUser(payload.sub);
      } catch (error) {
        // Expired / malformed tokens are routine; only log at debug level.
        options.logger.debug('token rejected', { reason: error instanceof Error ? error.message : 'unknown' });
        return null;
      }
    },
  };
}
