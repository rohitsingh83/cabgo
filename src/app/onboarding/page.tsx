import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

import { FinishSetup } from '@/components/auth/FinishSetup';
import { RoleSelection } from '@/components/auth/RoleSelection';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { requireUser, syncClerkMetadata } from '@/lib/auth';
import { dashboardPathForRole } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'Welcome',
  description: 'Choose how you want to use CabGo.',
};

// Depends on the signed-in user — never cache.
export const dynamic = 'force-dynamic';

/**
 * /onboarding — the post-sign-in resolver:
 *   not onboarded           → show the Rider / Driver picker
 *   onboarded               → send to the role dashboard
 *   onboarded, stale token  → repair Clerk metadata, refresh the token, then continue
 */
export default async function OnboardingPage() {
  const user = await requireUser();
  if (!user.is_active) redirect('/suspended');

  if (user.onboarding_completed) {
    const destination = dashboardPathForRole(user.role);
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    if (isDemo) redirect(destination);

    let sessionClaims: Record<string, unknown> | undefined = undefined;
    try {
      const session = auth();
      sessionClaims = session.sessionClaims as Record<string, unknown> | undefined;
    } catch {
      sessionClaims = undefined;
    }
    const tokenCustomised = sessionClaims?.metadata !== undefined;

    // Token isn't customised → middleware doesn't gate on it, nothing to repair.
    if (!tokenCustomised) redirect(destination);

    // Token IS customised but stale (middleware would otherwise have redirected us away).
    await syncClerkMetadata(user.clerk_id, user.role, true);
    return (
      <Shell>
        <FinishSetup redirectTo={destination} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8 space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Welcome aboard</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Hi{user.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} 👋 How will you use CabGo?
        </h1>
        <p className="text-muted-foreground">Pick one to personalise your experience — it only takes a moment.</p>
      </div>
      <RoleSelection initialName={user.full_name} initialPhone={user.phone ?? ''} email={user.email} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" aria-hidden />
      <header className="relative z-10 mx-auto flex max-w-4xl items-center justify-between p-4 sm:p-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">{children}</main>
    </div>
  );
}
