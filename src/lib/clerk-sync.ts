import 'server-only';

import type { User as ClerkBackendUser } from '@clerk/backend';
import type { UserJSON } from '@clerk/nextjs/server';

import { isUserRole } from '@/lib/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { User, UserRole } from '@/types';

/**
 * Keeps the Supabase `users` table in sync with Clerk. Used by the Clerk webhook
 * (primary path) and by `getCurrentUser()` as a fallback when the webhook has not
 * arrived yet (e.g. right after sign-up in local development).
 */

/** Provider-agnostic snapshot of a Clerk user. */
export interface NormalizedClerkUser {
  clerkId: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  imageUrl: string | null;
  role?: UserRole;
  onboardingComplete?: boolean;
}

function buildFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  username: string | null | undefined,
  email: string | null,
): string {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (username) return username;
  if (email) return email.split('@')[0] ?? '';
  return '';
}

/** Normalise the webhook payload (snake_case). */
export function normalizeWebhookUser(data: UserJSON): NormalizedClerkUser {
  const email =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ??
    data.email_addresses?.[0]?.email_address ??
    null;
  const phone =
    data.phone_numbers?.find((p) => p.id === data.primary_phone_number_id)?.phone_number ??
    data.phone_numbers?.[0]?.phone_number ??
    null;
  const metadata = (data.public_metadata ?? {}) as { role?: unknown; onboardingComplete?: unknown };

  return {
    clerkId: data.id,
    email,
    phone,
    fullName: buildFullName(data.first_name, data.last_name, data.username, email),
    imageUrl: data.image_url ?? null,
    role: isUserRole(metadata.role) ? metadata.role : undefined,
    onboardingComplete:
      typeof metadata.onboardingComplete === 'boolean' ? metadata.onboardingComplete : undefined,
  };
}

/** Normalise the Backend API user object (camelCase). */
export function normalizeBackendUser(user: ClerkBackendUser): NormalizedClerkUser {
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;
  const phone =
    user.phoneNumbers.find((p) => p.id === user.primaryPhoneNumberId)?.phoneNumber ??
    user.phoneNumbers[0]?.phoneNumber ??
    null;
  const metadata = (user.publicMetadata ?? {}) as { role?: unknown; onboardingComplete?: unknown };

  return {
    clerkId: user.id,
    email,
    phone,
    fullName: buildFullName(user.firstName, user.lastName, user.username, email),
    imageUrl: user.imageUrl ?? null,
    role: isUserRole(metadata.role) ? metadata.role : undefined,
    onboardingComplete:
      typeof metadata.onboardingComplete === 'boolean' ? metadata.onboardingComplete : undefined,
  };
}

/** Avatars from Clerk's CDN may be refreshed; custom uploads (Supabase Storage) must be preserved. */
function shouldReplaceAvatar(current: string | null): boolean {
  return !current || current.includes('img.clerk.com') || current.includes('images.clerk.dev');
}

/**
 * Insert the user if missing, otherwise refresh profile fields.
 * The database is the source of truth for `role` / `onboarding_completed` once a row exists —
 * only brand-new rows take these values from Clerk metadata.
 */
export async function upsertUserFromClerk(snapshot: NormalizedClerkUser): Promise<User> {
  const db = createSupabaseAdminClient();

  const { data: existing, error: selectError } = await db
    .from('users')
    .select('*')
    .eq('clerk_id', snapshot.clerkId)
    .maybeSingle();
  if (selectError) throw new Error(`users lookup failed: ${selectError.message}`);

  if (!existing) {
    const { data: created, error } = await db
      .from('users')
      .insert({
        clerk_id: snapshot.clerkId,
        email: snapshot.email,
        phone: snapshot.phone,
        full_name: snapshot.fullName,
        avatar_url: snapshot.imageUrl,
        role: snapshot.role ?? 'rider',
        onboarding_completed: snapshot.onboardingComplete ?? false,
      })
      .select('*')
      .single();

    if (error) {
      // Two concurrent callers (webhook + page request) can race on the unique clerk_id.
      if (error.code === '23505') {
        const { data: raced } = await db.from('users').select('*').eq('clerk_id', snapshot.clerkId).maybeSingle();
        if (raced) return raced;
      }
      throw new Error(`users insert failed: ${error.message}`);
    }
    return created;
  }

  const { data: updated, error } = await db
    .from('users')
    .update({
      email: snapshot.email ?? existing.email,
      phone: snapshot.phone ?? existing.phone,
      // Never clobber a name the user edited in-app with an empty Clerk value.
      full_name: snapshot.fullName || existing.full_name,
      avatar_url: shouldReplaceAvatar(existing.avatar_url) ? snapshot.imageUrl : existing.avatar_url,
    })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error) throw new Error(`users update failed: ${error.message}`);
  return updated;
}

/** Remove a user (and, via ON DELETE CASCADE, all of their data). */
export async function deleteUserByClerkId(clerkId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const { error } = await db.from('users').delete().eq('clerk_id', clerkId);
  if (error) throw new Error(`users delete failed: ${error.message}`);
}
