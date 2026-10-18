import Link from 'next/link';
import { ArrowRight, Wallet } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { PaymentDue } from '@/types';

/** Amber call-to-action listing rides that still need paying (server component). */
export function PaymentDueBanner({ dues }: { dues: PaymentDue[] }) {
  if (dues.length === 0) return null;
  const total = dues.reduce((sum, due) => sum + due.amount, 0);
  const [first] = dues;

  return (
    <section
      aria-label="Payment due"
      className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-card p-4"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
          <Wallet className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold">
            {formatCurrency(total)} due{dues.length > 1 ? ` · ${dues.length} rides` : ''}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {first.kind === 'cancellation_fee' ? 'Cancellation fee' : 'Trip'} to{' '}
            {first.dropoffAddress}
          </p>
        </div>
        <Link
          href={`/rider/tracking/${first.rideId}`}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Pay now <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      {dues.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-amber-500/20 pt-3">
          {dues.slice(1, 4).map((due) => (
            <li key={due.rideId}>
              <Link
                href={`/rider/tracking/${due.rideId}`}
                className="flex min-h-[44px] items-center justify-between gap-3 text-sm hover:text-brand"
              >
                <span className="truncate text-muted-foreground">{due.dropoffAddress}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatCurrency(due.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
