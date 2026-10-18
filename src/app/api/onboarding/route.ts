import { ApiError, ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { syncClerkMetadata } from '@/lib/auth';
import { dashboardPathForRole } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { onboardingSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/onboarding — one-time role selection after first sign-up.
 * Body: { role: 'rider' | 'driver', fullName: string, phone?: string }
 *
 * - Stores role + profile in Supabase (service role: the browser may not change roles).
 * - Mirrors role/onboardingComplete into Clerk public metadata so the middleware can enforce access.
 * - Drivers are sent to their profile page to register their vehicle (verification workflow).
 */
export const POST = withApi(async (request) => {
  const user = await requireApiUser();
  const input = await parseBody(request, onboardingSchema);

  // Idempotent: a finished onboarding is never overwritten (role is permanent for non-admins).
  if (user.onboarding_completed) {
    await syncClerkMetadata(user.clerk_id, user.role, true);
    return ok({ role: user.role, redirectTo: dashboardPathForRole(user.role), alreadyCompleted: true });
  }

  if (user.role === 'admin') {
    // Admins are provisioned out-of-band (seed / SQL). Never let them be downgraded here.
    throw new ApiError(403, 'Administrator accounts cannot change role');
  }

  const db = createSupabaseAdminClient();
  const { data: updated, error } = await db
    .from('users')
    .update({
      role: input.role,
      full_name: input.fullName,
      phone: input.phone ?? user.phone,
      onboarding_completed: true,
    })
    .eq('id', user.id)
    .eq('onboarding_completed', false) // guards against a double-submit race
    .select('*')
    .maybeSingle();

  if (error) {
    // 23505 → phone number already belongs to another account
    if (error.code === '23505') throw new ApiError(409, 'That phone number is already registered');
    throw new Error(`onboarding update failed: ${error.message}`);
  }
  if (!updated) throw new ApiError(409, 'Onboarding was already completed');

  // Tell Clerk (→ session token → middleware) that onboarding is done and which role was chosen.
  await syncClerkMetadata(updated.clerk_id, updated.role, true);

  const redirectTo = updated.role === 'driver' ? '/driver/profile?setup=1' : dashboardPathForRole(updated.role);
  return ok({ role: updated.role, redirectTo, alreadyCompleted: false }, 201);
}, 'POST /api/onboarding', { rateLimit: RATE_LIMITS.content });
