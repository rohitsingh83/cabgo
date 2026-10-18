'use client';

import { motion } from 'framer-motion';
import { Check, Flame, Users } from 'lucide-react';

import { VEHICLE_ICONS } from '@/components/ride/vehicle-icons';
import { ErrorState } from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { TAX_RATE, VEHICLES } from '@/lib/constants';
import { cn, formatCurrency, roundTo } from '@/lib/utils';
import type { FareEstimate, FareEstimateResponse, VehicleType } from '@/types';

interface VehicleSelectorProps {
  /** Null until the route is complete. */
  quote: FareEstimateResponse | null;
  hasRoute: boolean;
  loading: boolean;
  error: string | null;
  selected: VehicleType;
  onSelect: (type: VehicleType) => void;
  onRetry: () => void;
}

/** Total before the promo discount (so we can show it struck through). */
function originalTotal(estimate: FareEstimate): number {
  return roundTo(estimate.breakdown.subtotal * (1 + TAX_RATE));
}

export function VehicleSelector({ quote, hasRoute, loading, error, selected, onSelect, onRetry }: VehicleSelectorProps) {
  if (!hasRoute) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center">
        <p className="text-sm font-semibold">Choose your pickup and drop-off</p>
        <p className="mt-1 text-xs text-muted-foreground">Prices for every ride type appear here instantly.</p>
      </div>
    );
  }

  if (error) {
    return <ErrorState className="min-h-0 py-6" title="Couldn't load prices" message={error} onRetry={onRetry} />;
  }

  // First load (no previous quote to show) → skeleton rows.
  if (!quote) {
    return (
      <div className="space-y-2" aria-busy aria-label="Loading ride options">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quote.surge.multiplier > 1 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm"
        >
          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <p>
            <span className="font-bold">{quote.surge.multiplier.toFixed(1)}× surge.</span>{' '}
            <span className="text-muted-foreground">
              High demand in your area — fares are temporarily higher. The price shown is what you&apos;ll pay.
            </span>
          </p>
        </div>
      )}

      <div role="radiogroup" aria-label="Ride type" className={cn('space-y-2 transition-opacity', loading && 'opacity-60')}>
        {quote.estimates.map((estimate) => {
          const vehicle = VEHICLES[estimate.rideType];
          const Icon = VEHICLE_ICONS[estimate.rideType];
          const isSelected = selected === estimate.rideType;
          const discounted = estimate.breakdown.discount > 0;

          return (
            <button
              key={estimate.rideType}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(estimate.rideType)}
              className={cn(
                'relative flex min-h-[72px] w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected ? 'border-brand bg-brand/5 shadow-soft' : 'border-border bg-card hover:border-foreground/20',
              )}
            >
              {isSelected && (
                <motion.span
                  layoutId="vehicle-ring"
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${vehicle.gradient} text-white shadow-soft`}>
                <Icon className="h-6 w-6" aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-base font-extrabold">{vehicle.label}</span>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" aria-hidden /> {vehicle.capacity}
                  </span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">{vehicle.description}</span>
                <span
                  className={cn(
                    'mt-0.5 block text-xs font-semibold',
                    estimate.etaMinutes === null ? 'text-muted-foreground' : 'text-success',
                  )}
                >
                  {estimate.etaMinutes === null ? 'No drivers nearby right now' : `${estimate.etaMinutes} min away`}
                </span>
              </span>

              <span className="text-right">
                <span className="block font-display text-lg font-extrabold tabular-nums">
                  {formatCurrency(estimate.breakdown.total, estimate.breakdown.currency)}
                </span>
                {discounted && (
                  <span className="block text-xs tabular-nums text-muted-foreground line-through">
                    {formatCurrency(originalTotal(estimate), estimate.breakdown.currency)}
                  </span>
                )}
              </span>

              {isSelected && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
