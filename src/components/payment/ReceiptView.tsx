import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';

import { methodLabel } from '@/lib/payments/format';
import { receiptLines } from '@/lib/email/receipt';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { ReceiptData } from '@/types';

const STATUS = {
  completed: { label: 'Paid', icon: CheckCircle2, tone: 'bg-success text-white' },
  pending: { label: 'Payment pending', icon: Clock, tone: 'bg-amber-500 text-white' },
  failed: { label: 'Payment failed', icon: XCircle, tone: 'bg-destructive text-white' },
  refunded: { label: 'Refunded', icon: RotateCcw, tone: 'bg-brand text-white' },
} as const;

/** On-screen receipt (the downloadable/e-mailed HTML version is rendered in lib/email/receipt.ts). */
export function ReceiptView({ receipt }: { receipt: ReceiptData }) {
  const status = STATUS[receipt.status];
  const StatusIcon = status.icon;
  const money = (amount: number) =>
    amount < 0
      ? `−${formatCurrency(Math.abs(amount), receipt.currency)}`
      : formatCurrency(amount, receipt.currency);

  return (
    <article
      aria-label={`Receipt ${receipt.number}`}
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft print:rounded-none print:border-0 print:shadow-none"
    >
      {/* Header band — always dark so the amount pops in both colour modes */}
      <header className="relative overflow-hidden bg-black p-6 text-white sm:p-8 print:bg-black">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand/40 blur-3xl print:hidden"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 left-6 h-40 w-40 rounded-full bg-success/25 blur-3xl print:hidden"
        />
        <div className="relative flex items-start justify-between gap-3">
          <p className="font-display text-xl font-extrabold tracking-tight">
            Cab<span className="text-brand">Go</span>
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${status.tone}`}
          >
            <StatusIcon className="h-3.5 w-3.5" aria-hidden /> {status.label}
          </span>
        </div>
        <p className="relative mt-6 text-xs uppercase tracking-widest text-white/60">
          {receipt.kind === 'cancellation_fee' ? 'Cancellation fee' : 'Total paid'}
        </p>
        <p className="relative mt-1 font-display text-5xl font-extrabold tabular-nums tracking-tight">
          {money(receipt.total)}
        </p>
        <p className="relative mt-2 text-sm text-white/60">
          {formatDateTime(receipt.issuedAt)} · {methodLabel(receipt.method)}
        </p>
      </header>

      <div className="space-y-6 p-6 sm:p-8">
        {/* Route */}
        <section aria-label="Trip">
          <ol className="relative space-y-4">
            <span
              aria-hidden
              className="absolute bottom-3 left-[5px] top-3 w-0.5 bg-gradient-to-b from-success to-brand opacity-60"
            />
            <li className="flex items-start gap-4">
              <span className="relative mt-1.5 h-3 w-3 shrink-0 rounded-full bg-success ring-4 ring-card" />
              <span className="text-sm font-semibold leading-snug">{receipt.ride.pickup}</span>
            </li>
            {receipt.ride.stops.map((stop, index) => (
              <li key={`${stop}-${index}`} className="flex items-start gap-4">
                <span className="relative mt-1.5 h-3 w-3 shrink-0 rounded-full bg-amber-500 ring-4 ring-card" />
                <span className="text-sm leading-snug text-muted-foreground">via {stop}</span>
              </li>
            ))}
            <li className="flex items-start gap-4">
              <span className="relative mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-foreground ring-4 ring-card" />
              <span className="text-sm font-semibold leading-snug">{receipt.ride.dropoff}</span>
            </li>
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            {receipt.ride.vehicleLabel} · {receipt.ride.distanceKm.toFixed(1)} km ·{' '}
            {Math.max(1, Math.round(receipt.ride.durationMinutes))} min
            {receipt.driver && (
              <>
                {' '}
                · Driver{' '}
                <span className="font-semibold text-foreground">{receipt.driver.name}</span>
                {receipt.driver.vehicle ? ` (${receipt.driver.vehicle})` : ''}
              </>
            )}
          </p>
        </section>

        {/* Fare table */}
        <section aria-label="Charges" className="border-t border-border pt-4">
          <dl className="space-y-2.5">
            {receiptLines(receipt).map((line) => (
              <div key={line.label} className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd
                  className={`font-semibold tabular-nums ${line.tone === 'discount' ? 'text-success' : ''}`}
                >
                  {money(line.amount)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-4">
            <span className="font-display text-base font-extrabold">Total</span>
            <span className="font-display text-2xl font-extrabold tabular-nums">
              {money(receipt.total)}
            </span>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            Receipt {receipt.number} · Billed to {receipt.rider.name}
          </span>
          {receipt.stripeReceiptUrl && (
            <a
              href={receipt.stripeReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center font-semibold text-brand hover:underline print:hidden"
            >
              Stripe confirmation ↗
            </a>
          )}
        </footer>
      </div>
    </article>
  );
}
