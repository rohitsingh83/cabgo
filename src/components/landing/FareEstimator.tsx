'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bike, Car, CarFront, CarTaxiFront, Clock, Flame, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { VEHICLE_TYPES, VEHICLES } from '@/lib/constants';
import { calculateFare, estimateDurationMinutes } from '@/lib/fare';
import { cn, formatCurrency, formatDistance } from '@/lib/utils';
import type { VehicleType } from '@/types';

const ICONS: Record<VehicleType, LucideIcon> = {
  bike: Bike,
  auto: CarTaxiFront,
  sedan: Car,
  suv: CarFront,
};

/** Demo multiplier for the "peak hours" switch. */
const PEAK_SURGE = 1.5;

/**
 * Interactive price preview for the hero. Uses the exact same `calculateFare` as the
 * booking flow, so the number shown here matches what a rider will actually see.
 */
export function FareEstimator() {
  const [vehicle, setVehicle] = useState<VehicleType>('sedan');
  const [distance, setDistance] = useState(8);
  const [peak, setPeak] = useState(false);
  const sliderId = useId();

  const { fare, minutes } = useMemo(() => {
    const durationMinutes = estimateDurationMinutes(distance, vehicle);
    return {
      minutes: durationMinutes,
      fare: calculateFare({
        vehicleType: vehicle,
        distanceKm: distance,
        durationMinutes,
        surgeMultiplier: peak ? PEAK_SURGE : 1,
      }),
    };
  }, [vehicle, distance, peak]);

  // Percentage fill of the range track (drives the gradient behind the thumb).
  const fill = ((distance - 1) / 39) * 100;

  return (
    <div className="dark relative rounded-[1.75rem] border border-white/15 bg-white/[0.06] p-5 shadow-lift backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute -inset-px -z-10 rounded-[1.75rem] bg-brand-gradient opacity-20 blur-2xl" aria-hidden />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold text-white">Instant fare check</h2>
        <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-success">
          No signup
        </span>
      </div>

      {/* Route visual */}
      <div className="mt-5 flex items-center gap-3" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-success shadow-glow-green" />
        <span className="relative h-0.5 flex-1 overflow-hidden rounded bg-white/10">
          <span className="road-line absolute inset-0 h-full" />
        </span>
        <span className="h-3 w-3 rounded-[3px] bg-brand shadow-glow" />
      </div>
      <p className="mt-1.5 text-center text-xs font-semibold text-white/60">{formatDistance(distance)} trip</p>

      {/* Vehicle picker */}
      <div role="radiogroup" aria-label="Vehicle type" className="mt-5 grid grid-cols-4 gap-2">
        {VEHICLE_TYPES.map((type) => {
          const Icon = ICONS[type];
          const selected = vehicle === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setVehicle(type)}
              className={cn(
                'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                selected
                  ? 'border-brand bg-brand/20 text-white shadow-glow'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {VEHICLES[type].label}
            </button>
          );
        })}
      </div>

      {/* Distance slider */}
      <div className="mt-5">
        <label htmlFor={sliderId} className="flex items-center justify-between text-xs font-semibold text-white/70">
          <span>Distance</span>
          <span className="tabular-nums text-white">{distance} km</span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={1}
          max={40}
          step={1}
          value={distance}
          onChange={(event) => setDistance(Number(event.target.value))}
          className="mt-2 h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent accent-brand [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-glow"
          style={{
            background: `linear-gradient(90deg, #2563eb ${fill}%, rgba(255,255,255,0.12) ${fill}%) center / 100% 8px no-repeat`,
          }}
        />
      </div>

      {/* Peak toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={peak}
        onClick={() => setPeak((value) => !value)}
        className="mt-1 flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <Flame className={cn('h-4 w-4', peak ? 'text-warning' : 'text-white/40')} aria-hidden />
          Peak hours ({PEAK_SURGE}× surge)
        </span>
        <span
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            peak ? 'bg-warning' : 'bg-white/20',
          )}
          aria-hidden
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
              peak ? 'left-[22px]' : 'left-0.5',
            )}
          />
        </span>
      </button>

      {/* Result */}
      <div className="mt-4 rounded-2xl bg-black/40 p-4 ring-1 ring-white/10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Estimated total</p>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={fare.total}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="font-display text-4xl font-extrabold tabular-nums text-white"
              >
                {formatCurrency(fare.total)}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="flex items-center gap-1.5 pb-1.5 text-sm font-semibold text-white/70">
            <Clock className="h-4 w-4" aria-hidden /> ~{minutes} min
          </p>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/45">
          Includes {formatCurrency(fare.bookingFee)} booking fee and {formatCurrency(fare.tax)} GST
          {peak ? `, plus ${formatCurrency(fare.surgeAmount)} surge` : ''}. Indicative — the final fare is
          locked when you book.
        </p>
      </div>

      <Button asChild variant="brand" size="lg" className="mt-4 w-full">
        <Link href={process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? '/rider' : '/sign-up'}>
          Book this ride <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
