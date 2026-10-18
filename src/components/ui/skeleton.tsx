import * as React from 'react';

import { cn } from '@/lib/utils';

/** Loading placeholder with a diagonal shimmer sweep (see `.shimmer` in globals.css). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('shimmer rounded-xl bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
