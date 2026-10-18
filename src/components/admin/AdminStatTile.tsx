import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

interface AdminStatTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. */
  tone: string;
  href?: string;
  /** Pulses the tile red/amber when something needs attention. */
  attention?: boolean;
}

/** KPI tile; becomes a link when it has somewhere useful to go. */
export function AdminStatTile({ label, value, hint, icon: Icon, tone, href, attention }: AdminStatTileProps) {
  const body = (
    <>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12', tone)}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p>
        <p className="text-xs font-medium sm:truncate">{label}</p>
        {hint && <p className="text-xs text-muted-foreground sm:truncate">{hint}</p>}
      </div>
    </>
  );
  const classes = cn(
    'flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 transition-colors sm:flex-row sm:items-center sm:gap-4',
    attention ? 'border-amber-500/50' : 'border-border',
    href && 'hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
