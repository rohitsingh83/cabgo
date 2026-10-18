'use client';

import { useEffect, useState } from 'react';
import { SignOutButton, useSession } from '@/lib/auth/clerk-client';
import { AlertTriangle } from 'lucide-react';

import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface FinishSetupProps {
  redirectTo: string;
}

const ATTEMPT_KEY = 'cabgo:finish-setup-attempts';
const MAX_ATTEMPTS = 3;

/**
 * Shown when the database says onboarding is complete but the session token is stale
 * (e.g. the user finished onboarding on another device). We refresh the token and
 * hard-navigate to the dashboard. A sessionStorage counter prevents an endless redirect loop
 * if the Clerk session token was never customised (see src/types/clerk.d.ts).
 */
export function FinishSetup({ redirectTo }: FinishSetupProps) {
  const { isLoaded, session } = useSession();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!isLoaded || !session) return;

    const attempts = Number(sessionStorage.getItem(ATTEMPT_KEY) ?? '0');
    if (attempts >= MAX_ATTEMPTS) {
      setStuck(true);
      return;
    }
    sessionStorage.setItem(ATTEMPT_KEY, String(attempts + 1));

    let cancelled = false;
    void (async () => {
      try {
        await session.getToken({ skipCache: true });
      } finally {
        if (!cancelled) window.location.assign(redirectTo);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, session, redirectTo]);

  if (stuck) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>We couldn’t refresh your session</AlertTitle>
          <AlertDescription>
            Your account is ready, but your session token doesn’t include your role yet. Sign out and
            back in. If this keeps happening, the app owner needs to add{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{ "metadata": "{{user.public_metadata}}" }'}</code>{' '}
            to the Clerk session token.
          </AlertDescription>
        </Alert>
        <SignOutButton redirectUrl="/sign-in">
          <Button className="w-full" variant="outline" onClick={() => sessionStorage.removeItem(ATTEMPT_KEY)}>
            Sign out
          </Button>
        </SignOutButton>
      </div>
    );
  }

  return <LoadingSpinner size="lg" label="Finishing setup…" className="py-16" />;
}
