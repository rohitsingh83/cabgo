'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import * as ClerkReal from '@clerk/nextjs';

import { DEMO_ADMIN, DEMO_DRIVER, DEMO_RIDER } from '@/lib/demo/seed-data';
import type { User, UserRole } from '@/types';
import { DemoAuthCard } from '@/components/auth/DemoAuthCard';

/**
 * Indicates whether the application runs in self-contained zero-friction demo mode.
 * Evaluates to true when:
 * 1. NEXT_PUBLIC_DEMO_MODE === 'true'
 * 2. Or Clerk publishable key is not set, is a REPLACE_ME placeholder, or points to dummy example.clerk.accounts.dev.
 */
export const isDemoAuth =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('example.clerk.accounts.dev') ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_REPLACE');

interface DemoAuthContextValue {
  role: UserRole;
  user: User;
  setRole: (role: UserRole) => void;
}

const DemoAuthContext = createContext<DemoAuthContextValue | null>(null);

function getPersonaForRole(role: UserRole): User {
  if (role === 'admin') return DEMO_ADMIN;
  if (role === 'driver') return DEMO_DRIVER;
  return DEMO_RIDER;
}

function resolveDemoRole(pathname?: string): UserRole {
  if (typeof window === 'undefined') return 'rider';

  // 1. Cookie takes precedence
  const match = document.cookie.match(/cabgo_demo_role=([^;]+)/);
  if (match && (match[1] === 'rider' || match[1] === 'driver' || match[1] === 'admin')) {
    return match[1] as UserRole;
  }

  // 2. Pathname inference fallback
  const p = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/driver')) return 'driver';
  return 'rider';
}

/**
 * Self-contained demo auth provider for local testing and showcase mode.
 * Neutralizes external network requests to invalid Clerk tenants while maintaining
 * identical API compatibility across useAuth, useUser, useSession, and useClerk.
 */
export function DemoClerkProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRoleState] = useState<UserRole>('rider');

  useEffect(() => {
    setRoleState(resolveDemoRole(pathname));
  }, [pathname]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (typeof document !== 'undefined') {
      document.cookie = `cabgo_demo_role=${newRole}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  const user = useMemo(() => getPersonaForRole(role), [role]);
  const value = useMemo(() => ({ role, user, setRole }), [role, user]);

  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

// ----------------------------------------------------------------------------
// Custom Demo Hooks
// ----------------------------------------------------------------------------

function useDemoAuthHook() {
  const ctx = useContext(DemoAuthContext);
  const role = ctx?.role ?? resolveDemoRole();
  const user = ctx?.user ?? getPersonaForRole(role);

  return useMemo(
    () => ({
      isLoaded: true,
      isSignedIn: true,
      userId: user.clerk_id,
      sessionId: `demo-sess-${role}`,
      actor: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      has: () => true,
      signOut: async () => {
        if (typeof window !== 'undefined') {
          document.cookie = 'cabgo_demo_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'cabgo_user_data=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'cabgo_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          window.location.href = '/sign-in';
        }
      },
      getToken: async () => `demo-token:${role}`,
    }),
    [role, user],
  );
}

function useDemoUserHook() {
  const ctx = useContext(DemoAuthContext);
  const role = ctx?.role ?? resolveDemoRole();
  const user = ctx?.user ?? getPersonaForRole(role);

  return useMemo(
    () => ({
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: user.clerk_id,
        fullName: user.full_name,
        firstName: user.full_name.split(' ')[0],
        lastName: user.full_name.split(' ').slice(1).join(' '),
        primaryEmailAddress: { emailAddress: user.email },
        emailAddresses: [{ emailAddress: user.email, id: `demo-email-${role}` }],
        imageUrl: user.avatar_url ?? `https://api.dicebear.com/7.x/bottts/svg?seed=${role}`,
        hasImage: true,
        publicMetadata: {
          role,
          onboardingComplete: user.onboarding_completed,
        },
        update: async () => {},
        reload: async () => {},
      },
    }),
    [role, user],
  );
}

function useDemoSessionHook() {
  const ctx = useContext(DemoAuthContext);
  const role = ctx?.role ?? resolveDemoRole();
  const user = ctx?.user ?? getPersonaForRole(role);

  return useMemo(
    () => ({
      isLoaded: true,
      isSignedIn: true,
      session: {
        id: `demo-sess-${role}`,
        status: 'active',
        lastActiveAt: new Date(),
        expireAt: new Date(Date.now() + 86400000),
        user,
        touch: async () => {},
        checkAuthorization: () => true,
        getToken: async () => `demo-token:${role}`,
      },
    }),
    [role, user],
  );
}

function useDemoClerkHook() {
  const ctx = useContext(DemoAuthContext);
  const role = ctx?.role ?? resolveDemoRole();
  const user = ctx?.user ?? getPersonaForRole(role);

  return useMemo(
    () => ({
      loaded: true,
      user,
      session: { id: `demo-sess-${role}` },
      signOut: async (opts?: { redirectUrl?: string }) => {
        if (typeof window !== 'undefined') {
          document.cookie = 'cabgo_demo_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'cabgo_user_data=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'cabgo_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          window.location.href = opts?.redirectUrl || '/sign-in';
        }
      },
      openSignIn: () => {
        if (typeof window !== 'undefined') window.location.href = '/sign-in';
      },
      openSignUp: () => {
        if (typeof window !== 'undefined') window.location.href = '/sign-up';
      },
      redirectToSignIn: (_opts?: { returnBackUrl?: string }) => {
        if (typeof window !== 'undefined') window.location.href = '/sign-in';
      },
      redirectToSignUp: (_opts?: { returnBackUrl?: string }) => {
        if (typeof window !== 'undefined') window.location.href = '/sign-up';
      },
      openUserProfile: () => {
        if (typeof window !== 'undefined') {
          const profilePath = role === 'driver' ? '/driver/profile' : role === 'admin' ? '/admin' : '/rider/profile';
          window.location.href = profilePath;
        }
      },
    }),
    [role, user],
  );
}

// ----------------------------------------------------------------------------
// Custom Demo Components
// ----------------------------------------------------------------------------

export function DemoSignOutButton({
  children,
  redirectUrl = '/',
}: {
  children?: React.ReactNode;
  redirectUrl?: string;
}) {
  const clerk = useDemoClerkHook();
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    void clerk.signOut({ redirectUrl });
  };

  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, {
      onClick: handleClick,
    });
  }

  return (
    <button type="button" onClick={handleClick} className="text-sm font-medium hover:underline">
      {children ?? 'Sign out'}
    </button>
  );
}

export function DemoSignIn() {
  return <DemoAuthCard mode="sign-in" />;
}

export function DemoSignUp() {
  return <DemoAuthCard mode="sign-up" />;
}

export function DemoSignedIn({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function DemoSignedOut({ children: _children }: { children?: React.ReactNode }) {
  return null;
}

export function DemoUserButton() {
  return null;
}

// ----------------------------------------------------------------------------
// Unified Dual-Mode Exports:
// When isDemoAuth is true, use the zero-external-dependency Demo implementation.
// When in production with valid keys, delegate seamlessly to @clerk/nextjs.
// ----------------------------------------------------------------------------

export const ClerkProvider = isDemoAuth ? DemoClerkProvider : ClerkReal.ClerkProvider;
export const useAuth = isDemoAuth ? useDemoAuthHook : ClerkReal.useAuth;
export const useUser = isDemoAuth ? useDemoUserHook : ClerkReal.useUser;
export const useSession = isDemoAuth ? useDemoSessionHook : ClerkReal.useSession;
export const useClerk = isDemoAuth ? useDemoClerkHook : ClerkReal.useClerk;

export const SignOutButton = isDemoAuth ? DemoSignOutButton : ClerkReal.SignOutButton;
export const SignIn = isDemoAuth ? DemoSignIn : ClerkReal.SignIn;
export const SignUp = isDemoAuth ? DemoSignUp : ClerkReal.SignUp;
export const SignedIn = isDemoAuth ? DemoSignedIn : ClerkReal.SignedIn;
export const SignedOut = isDemoAuth ? DemoSignedOut : ClerkReal.SignedOut;
export const UserButton = isDemoAuth ? DemoUserButton : ClerkReal.UserButton;
