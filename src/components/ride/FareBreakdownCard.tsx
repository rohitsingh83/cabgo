'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Receipt } from 'lucide-react';

import { cn, formatCurrency, formatDistance, formatDuration } from '@/lib/utils';
import type { FareBreakdown } from '@/types';

interface FareBreakdownCardProps {
  breakdown: FareBreakdown;
  distanceKm: number;
  durationMinutes: number;
  surgeMultiplier?: number;
  stopCount?: number;
  /** Render as an expandable row (booking) instead of a static list (receipts, tracking). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

interface Row {
  label: string;
  hint?: string;
  amount: number;
  tone?: 'discount' | 'surge';
}

/** Itemised fare: base, distance, time, stops, surge, booking fee, promo, GST, total. */
export function FareBreakdownCard({
  breakdown,
  distanceKm,
  durationMinutes,
  surgeMultiplier = 1,
  stopCount = 0,
  collapsible = true,
  defaultOpen = false,
  className,
}: FareBreakdownCardProps) {
  const [open, setOpen] = useState(!collapsible || defaultOpen);
  const money = (value: number) => formatCurrency(value, breakdown.currency);

  const rows: Row[] = [
    { label: 'Base fare', amount: breakdown.baseFare },
    { label: 'Distance', hint: formatDistance(distanceKm), amount: breakdown.distanceFare },
    { label: 'Time', hint: formatDuration(durationMinutes), amount: breakdown.timeFare },
  ];
  if (breakdown.stopsFee > 0) {
    rows.push({ label: 'Extra stops', hint: `${stopCount} stop${stopCount === 1 ? '' : 's'}`, amount: breakdown.stopsFee });
  }
  if (breakdown.surgeAmount > 0) {
    rows.push({ label: 'Surge pricing', hint: `${surgeMultiplier.toFixed(1)}×`, amount: breakdown.surgeAmount, tone: 'surge' });
  }
  rows.push({ label: 'Booking fee', amount: breakdown.bookingFee });
  if (breakdown.discount > 0) {
    rows.push({ label: 'Promo discount', amount: -breakdown.discount, tone: 'discount' });
  }
  rows.push({ label: 'GST (5%)', amount: breakdown.tax });

  const list = (
    <dl className="space-y-2 px-4 pb-4 pt-1 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            {row.label}
            {row.hint && <span className="ml-1.5 text-xs">· {row.hint}</span>}
          </dt>
          <dd
            className={cn(
              'font-semibold tabular-nums',
              row.tone === 'discount' && 'text-success',
              row.tone === 'surge' && 'text-amber-600 dark:text-amber-400',
            )}
          >
            {row.amount < 0 ? `−${money(Math.abs(row.amount))}` : money(row.amount)}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-dashed border-border pt-3">
        <dt className="font-display text-base font-extrabold">Total</dt>
        <dd className="font-display text-xl font-extrabold tabular-nums">{money(breakdown.total)}</dd>
      </div>
    </dl>
  );

  return (
    <section className={cn('overflow-hidden rounded-2xl border border-border bg-card', className)} aria-label="Fare breakdown">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-brand" aria-hidden /> Fare breakdown
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      ) : (
        <h3 className="flex items-center gap-2 px-4 pb-1 pt-4 text-sm font-semibold">
          <Receipt className="h-4 w-4 text-brand" aria-hidden /> Fare breakdown
        </h3>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {list}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
