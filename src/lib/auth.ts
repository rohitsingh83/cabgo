import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth, clerkClient } from '@clerk/nextjs/server';

import { normalizeBackendUser, upsertUserFromClerk } from '@/lib/clerk-sync';
import { DEMO_ADMIN, DEMO_DRIVER, DEMO_RIDER } from '@/lib/demo/seed-data';
import { dashboardPathForRole } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { User, UserRole } from '@/types';

/**
 * Server-side auth helpers for Server Components, layouts and route handlers.
 *
 * Middleware gives a fast first line of defence using JWT claims; these helpers are the
 * authoritative check against the database (role, suspension, onboarding state).
 */

/**
 * The signed-in user's Supabase row — or null when signed out.
 * Memoised per request with React `cache`, so layouts + pages share one query.
 *
 * If the Clerk webhook has not delivered yet, the row is created on the fly from Clerk's
 * Backend API so the very first page load after sign-up never fails.
 * In demo mode (or with unconfigured local keys), seeded personas are provided.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  // Check if Demo / Local Showcase mode is active
  const isDemo =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref') ||
    !process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY === 'sk_test_REPLACE_ME';

  if (isDemo) {
    try {
      const cookieStore = cookies();
      const demoRole = cookieStore.get('cabgo_demo_role')?.value;
      const userDataCookie = cookieStore.get('cabgo_user_data')?.value;

      if (userDataCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(userDataCookie));
          if (parsed && (parsed.full_name || parsed.fullName || parsed.email || parsed.phone)) {
            const role = (parsed.role as UserRole) || 'rider';
            const baseUser = role === 'admin' ? DEMO_ADMIN : role === 'driver' ? DEMO_DRIVER : DEMO_RIDER;
            const isUuid = Boolean(parsed.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id));
            const id = isUuid ? parsed.id : baseUser.id;
            return {
              ...baseUser,
              id,
              clerk_id: parsed.id || baseUser.clerk_id,
              full_name: parsed.fullName || parsed.full_name || baseUser.full_name,
              email: parsed.email || baseUser.email,
              phone: parsed.phone || baseUser.phone,
              avatar_url: parsed.avatarUrl || parsed.avatar_url || baseUser.avatar_url,
              role,
            };
          }
        } catch {
          // ignore parsing error
        }
      }

      if (demoRole === 'admin') return DEMO_ADMIN;
      if (demoRole === 'driver') return DEMO_DRIVER;
      if (demoRole === 'rider') return DEMO_RIDER;
    } catch {
      // cookies() or headers() can be unavailable during static build / prerender phases
    }
    // No role or user cookie set: the user is NOT signed in. Sign-in is mandatory.
    return null;
  }

  let userId: string | null = null;
  try {
    const session = auth();
    userId = session?.userId ?? null;
  } catch {
    userId = null;
  }

  if (userId) {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('users').select('*').eq('clerk_id', userId).maybeSingle();
    if (error) throw new Error(`Failed to load current user: ${error.message}`);
    if (data) return data;

    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      return upsertUserFromClerk(normalizeBackendUser(clerkUser));
    } catch {
      // In case clerkClient is unconfigured or rate limited
    }
  }

  return null;
});

/** Redirects to /sign-in when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  return user;
}

/**
 * Page/layout guard: signed in → onboarded → active → allowed role.
 * Wrong role? The user is bounced to *their own* dashboard instead of a 403 page.
 */
export async function requireRole(allowed: UserRole | readonly UserRole[]): Promise<User> {
  const user = await requireUser();
  if (!user.is_active) redirect('/suspended');
  if (!user.onboarding_completed) redirect('/onboarding');

  const roles = Array.isArray(allowed) ? (allowed as readonly UserRole[]) : [allowed as UserRole];
  if (!roles.includes(user.role)) {
    const isDemo =
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref') ||
      !process.env.CLERK_SECRET_KEY ||
      process.env.CLERK_SECRET_KEY === 'sk_test_REPLACE_ME';

    if (isDemo) {
      const target = roles[0];
      if (target === 'admin') return DEMO_ADMIN;
      if (target === 'driver') return DEMO_DRIVER;
      if (target === 'rider') return DEMO_RIDER;
    }
    redirect(dashboardPathForRole(user.role));
  }
  return user;
}

/**
 * Mirror the role/onboarding state into Clerk public metadata so the session token (and
 * therefore the middleware) knows about it. Safe to call repeatedly.
 */
export async function syncClerkMetadata(clerkId: string, role: UserRole, onboardingComplete: boolean): Promise<void> {
  try {
    if (process.env.CLERK_SECRET_KEY && process.env.CLERK_SECRET_KEY !== 'sk_test_REPLACE_ME') {
      await clerkClient.users.updateUserMetadata(clerkId, {
        publicMetadata: { role, onboardingComplete },
      });
    }
  } catch (err) {
    console.warn('syncClerkMetadata skipped or failed:', err);
  }
}

