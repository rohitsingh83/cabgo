import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';

import { PaymentStatusBadge } from '@/components/payment/PaymentStatusBadge';
import { Stars } from '@/components/rating/Stars';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { VEHICLE_ICONS } from '@/components/ride/vehicle-icons';
import { VEHICLES } from '@/lib/constants';
import { cn, formatCurrency, formatDateTime, formatDistance } from '@/lib/utils';
import type { PaymentStatus, Ride } from '@/types';

interface RideCardProps {
  ride: Pick<
    Ride,
    | 'id'
    | 'status'
    | 'ride_type'
    | 'pickup_address'
    | 'dropoff_address'
    | 'created_at'
    | 'distance_km'
    | 'estimated_fare'
    | 'final_fare'
    | 'cancellation_fee'
    | 'stops'
  >;
  href?: string;
  className?: string;
  /** History view only: adds payment / rating chips (and the fare on mobile) under the addresses. */
  meta?: {
    paymentStatus: PaymentStatus | null;
    /** Stars the rider gave, if any. */
    rating: number | null;
    /** Completed, unrated and still inside the rating window → show a "Rate" nudge. */
    canRate: boolean;
  };
}

/** Compact ride summary used on the dashboard and in history. */
export function RideCard({ ride, href = `/rider/tracking/${ride.id}`, className, meta }: RideCardProps) {
  const vehicle = VEHICLES[ride.ride_type];
  const Icon = VEHICLE_ICONS[ride.ride_type];
  const cancelled = ride.status === 'cancelled';
  const fee = Number(ride.cancellation_fee);
  const amount = cancelled ? fee : Number(ride.final_fare ?? ride.estimated_fare);

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${vehicle.gradient} text-white`}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">{formatDateTime(ride.created_at)}</p>
          <RideStatusBadge status={ride.status} />
        </div>
        <p className="mt-1.5 truncate text-sm font-semibold">{ride.dropoff_address}</p>
        <p className="truncate text-xs text-muted-foreground">
          From {ride.pickup_address}
          {ride.stops.length > 0 && ` · ${ride.stops.length} stop${ride.stops.length === 1 ? '' : 's'}`}
        </p>
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {meta.paymentStatus && <PaymentStatusBadge status={meta.paymentStatus} />}
            {meta.rating !== null ? (
              <Stars value={meta.rating} className="h-3.5 w-3.5" />
            ) : (
              meta.canRate && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3" aria-hidden /> Rate this ride
                </span>
              )
            )}
            {!(cancelled && fee === 0) && <span className="ml-auto font-display text-sm font-extrabold tabular-nums sm:hidden">{formatCurrency(amount)}</span>}
          </div>
        )}
      </div>

      <div className="hidden text-right sm:block">
        <p className={cn('font-display text-lg font-extrabold tabular-nums', cancelled && fee === 0 && 'text-muted-foreground')}>
          {cancelled && fee === 0 ? '—' : formatCurrency(amount)}
        </p>
        <p className="text-xs text-muted-foreground">{formatDistance(ride.distance_km)}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
