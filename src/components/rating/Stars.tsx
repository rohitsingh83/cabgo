import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Read-only star row (server-safe). Rounds to the nearest whole star. */
export function Stars({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={cn(className, index < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} aria-hidden />
      ))}
    </span>
  );
}
