'use client';

import { Check, Clock, Loader2, MapPin, Navigation, X } from 'lucide-react';

import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/use-now';
import { cn, formatCurrency, formatDistance, formatDuration } from '@/lib/utils';
import type { DriverRideRequest } from '@/types';

interface RideRequestCardProps {
  request: DriverRideRequest;
  accepting: boolean;
  /** Another request is being accepted — disable this one's button. */
  locked: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/** One incoming request: route, distance to pickup, fare and what the driver keeps. */
export function RideRequestCard({ request, accepting, locked, onAccept, onDecline }: RideRequestCardProps) {
  const { ride, rider, pickupDistanceKm, estimatedEarnings } = request;
  const now = useNow(5000);
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - new Date(ride.created_at).getTime()) / 1000));
  const fresh = ageSeconds < 60;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={rider?.full_name} src={rider?.avatar_url} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{rider?.full_name ?? 'Rider'}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden />
              <span className={cn(fresh && 'font-semibold text-success')}>{fresh ? 'Just now' : `${Math.floor(ageSeconds / 60)} min ago`}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-extrabold tabular-nums text-success">{formatCurrency(estimatedEarnings)}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">You earn · fare {formatCurrency(Number(ride.estimated_fare))}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand">
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          {formatDistance(pickupDistanceKm)} to pickup
        </div>

        <ol className="relative space-y-3">
          <span aria-hidden className="absolute bottom-3 left-[5px] top-3 w-0.5 bg-gradient-to-b from-success to-brand opacity-60" />
          <li className="relative flex items-start gap-3">
            <span className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full bg-success ring-4 ring-card" aria-hidden />
            <p className="text-sm font-medium leading-snug">{ride.pickup_address}</p>
          </li>
          {ride.stops.map((stop, index) => (
            <li key={`${stop.lat}-${stop.lng}-${index}`} className="relative flex items-start gap-3">
              <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground ring-4 ring-card" aria-hidden />
              <p className="text-sm leading-snug text-muted-foreground">Stop {index + 1}: {stop.address}</p>
            </li>
          ))}
          <li className="relative flex items-start gap-3">
            <span className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-brand ring-4 ring-card" aria-hidden />
            <p className="text-sm font-medium leading-snug">{ride.dropoff_address}</p>
          </li>
        </ol>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {formatDistance(ride.distance_km)} · {formatDuration(ride.duration_minutes)}
          {ride.stops.length > 0 && ` · ${ride.stops.length} stop${ride.stops.length === 1 ? '' : 's'}`}
          {Number(ride.surge_multiplier) > 1 && <span className="font-semibold text-amber-600 dark:text-amber-400"> · {Number(ride.surge_multiplier).toFixed(1)}× surge</span>}
        </p>
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <Button variant="outline" className="h-12 w-12 shrink-0 px-0" onClick={onDecline} disabled={accepting} aria-label="Decline request">
          <X className="h-5 w-5" aria-hidden />
        </Button>
        <Button variant="success" className="h-12 flex-1 text-base font-bold" onClick={onAccept} disabled={accepting || locked}>
          {accepting ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {accepting ? 'Accepting…' : 'Accept ride'}
        </Button>
      </div>
    </article>
  );
}
