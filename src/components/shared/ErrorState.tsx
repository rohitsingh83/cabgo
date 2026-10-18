'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Next.js error digest — shown so users can quote it to support. */
  digest?: string;
  onRetry?: () => void;
  /** Fill the viewport (root-level errors) instead of sitting inline. */
  fullScreen?: boolean;
  className?: string;
}

/** Friendly, themed error panel used by every error boundary and failed data fetch. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We hit a bump on the road. Please try again — if it keeps happening, contact support.',
  digest,
  onRetry,
  fullScreen = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center',
        fullScreen ? 'min-h-screen' : 'min-h-[50vh] py-12',
        className,
      )}
    >
      <div className="relative mb-6">
        <span className="absolute inset-0 -z-10 rounded-full bg-destructive/20 blur-2xl" aria-hidden />
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-destructive/30 bg-destructive/10 text-destructive">
          <TriangleAlert className="h-9 w-9" aria-hidden />
        </div>
      </div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      {digest && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
          Reference: {digest}
        </p>
      )}
      {onRetry && (
        <Button onClick={onRetry} className="mt-6" variant="brand">
          <RotateCcw /> Try again
        </Button>
      )}
    </div>
  );
}
