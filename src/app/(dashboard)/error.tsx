'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/shared/ErrorState';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console + any attached monitoring (Sentry, LogRocket …).
    console.error('[dashboard] route error:', error);
  }, [error]);

  return <ErrorState digest={error.digest} onRetry={reset} />;
}
