import type { UserRole } from '@/types';

/**
 * Pure (edge-safe) role helpers shared by the middleware, server components and the UI.
 * Do NOT import server-only modules here — this file is bundled into the Edge runtime.
 */

export const USER_ROLES: readonly UserRole[] = ['rider', 'driver', 'admin'] as const;
/** Roles a person may pick for themselves during onboarding. */
export const SELF_SELECTABLE_ROLES = ['rider', 'driver'] as const;
export type SelfSelectableRole = (typeof SELF_SELECTABLE_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** Home dashboard route for a role. */
export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case 'driver':
      return '/driver';
    case 'admin':
      return '/admin';
    case 'rider':
    default:
      return '/rider';
  }
}

/** Which dashboard section a pathname belongs to (null for non-dashboard routes). */
export function sectionForPath(pathname: string): UserRole | null {
  if (pathname === '/rider' || pathname.startsWith('/rider/')) return 'rider';
  if (pathname === '/driver' || pathname.startsWith('/driver/')) return 'driver';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  return null;
}

/** May a user with `role` open a page that lives in `section`? Admins may only see /admin. */
export function canAccessSection(role: UserRole, section: UserRole): boolean {
  return role === section;
}

/** Human readable role name. */
export function roleLabel(role: UserRole): string {
  return role === 'admin' ? 'Administrator' : role === 'driver' ? 'Driver partner' : 'Rider';
}
