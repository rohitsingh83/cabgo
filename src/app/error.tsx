'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/shared/ErrorState';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] route error:', error);
  }, [error]);

  return <ErrorState fullScreen digest={error.digest} onRetry={reset} />;
}
