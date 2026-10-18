import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Optional caption shown under the spinner. */
  label?: string;
  /** Center in the viewport (route-level loading states). */
  fullScreen?: boolean;
  className?: string;
}

const dimensions = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' } as const;

/** Gradient ring spinner. */
export function LoadingSpinner({ size = 'md', label, fullScreen = false, className }: LoadingSpinnerProps) {
  const spinner = (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3', className)}
    >
      <span
        className={cn(
          'animate-spin rounded-full border-[3px] border-muted border-t-brand border-r-brand-purple',
          dimensions[size],
        )}
      />
      {label ? <p className="text-sm font-medium text-muted-foreground">{label}</p> : <span className="sr-only">Loading…</span>}
    </div>
  );

  if (!fullScreen) return spinner;
  return <div className="flex min-h-screen items-center justify-center bg-background">{spinner}</div>;
}
