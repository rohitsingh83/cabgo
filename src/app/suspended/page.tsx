import type { Metadata } from 'next';
import { SignOutButton } from '@/lib/auth/clerk-client';
import { ShieldAlert } from 'lucide-react';

import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Account suspended',
  robots: { index: false },
};

/** Shown to users an administrator has deactivated (users.is_active = false). */
export default function SuspendedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-center">
      <Logo />
      <div className="max-w-md space-y-4">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">Your account is suspended</h1>
        <p className="text-muted-foreground">
          An administrator has temporarily disabled this account. If you think this is a mistake,
          please contact our support team and we’ll look into it right away.
        </p>
      </div>
      <SignOutButton redirectUrl="/sign-in">
        <Button variant="outline" size="lg">
          Sign out
        </Button>
      </SignOutButton>
    </main>
  );
}
