import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import type { Ride } from '@/types';

/** Titled card used on every admin detail page. */
export function AdminSection({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label / value list. */
export function InfoList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-right font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> {children}
    </Link>
  );
}

type RideLine = Pick<Ride, 'id' | 'status' | 'pickup_address' | 'dropoff_address' | 'created_at' | 'estimated_fare' | 'final_fare'>;

/** Compact, tappable list of rides (user and driver detail pages). */
export function RideLinkList({ rides, empty }: { rides: RideLine[]; empty: string }) {
  if (rides.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="-mx-2 space-y-1">
      {rides.map((ride) => (
        <li key={ride.id}>
          <Link href={`/admin/rides/${ride.id}`} className="flex min-h-[56px] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {ride.pickup_address} → {ride.dropoff_address}
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(ride.created_at)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <RideStatusBadge status={ride.status} />
              <span className="text-xs font-semibold tabular-nums">{formatCurrency(Number(ride.final_fare ?? ride.estimated_fare))}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Big-number tile for the stats strip on detail pages. */
export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="truncate font-display text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
