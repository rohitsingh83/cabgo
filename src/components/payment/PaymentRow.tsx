import Link from 'next/link';
import { ArrowRight, Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react';

import { PaymentStatusBadge } from '@/components/payment/PaymentStatusBadge';
import { methodLabel } from '@/lib/payments/format';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { PaymentListItem } from '@/types';

const METHOD_ICON: Record<string, typeof CreditCard> = {
  card: CreditCard,
  upi: Smartphone,
  wallet: Wallet,
  cash: Banknote,
};

/** One payment in the history list — links to its receipt. */
export function PaymentRow({ payment }: { payment: PaymentListItem }) {
  const Icon = METHOD_ICON[payment.payment_method] ?? CreditCard;
  const isFee = payment.ride?.status === 'cancelled';
  const refunded = payment.status === 'refunded';

  return (
    <Link
      href={`/rider/payments/${payment.id}`}
      className="group flex min-h-[72px] items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {payment.ride
            ? `${isFee ? 'Cancellation fee · ' : ''}${payment.ride.dropoff_address}`
            : 'Ride payment'}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDateTime(payment.created_at)} · {methodLabel(payment.payment_method)}
        </p>
        {payment.status === 'failed' && payment.failure_reason && (
          <p className="mt-0.5 truncate text-xs text-destructive">{payment.failure_reason}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={`font-display text-base font-extrabold tabular-nums ${refunded ? 'text-muted-foreground line-through' : ''}`}
        >
          {formatCurrency(Number(payment.amount), payment.currency)}
        </span>
        <PaymentStatusBadge status={payment.status} />
      </div>
      <ArrowRight
        className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
        aria-hidden
      />
    </Link>
  );
}
