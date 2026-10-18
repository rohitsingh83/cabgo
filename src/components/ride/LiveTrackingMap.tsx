'use client';

import { useMemo } from 'react';
import { Clock, MapPin, Radio, WifiOff } from 'lucide-react';

import { BookingMap } from '@/components/maps/BookingMap';
import type { LiveChannel, LiveDriverLocation } from '@/hooks/use-ride-live';
import { estimateEta } from '@/lib/rides/eta';
import { cn, formatDistance } from '@/lib/utils';
import type { NearbyDriverMarker, RideWithRelations } from '@/types';

interface LiveTrackingMapProps {
  ride: RideWithRelations;
  /** Best known driver position (live stream, or the last position saved on the server). */
  position: LiveDriverLocation | null;
  channel: LiveChannel;
  className?: string;
}

/**
 * The rider's map once a driver is assigned: route, pickup/drop-off, the car gliding along,
 * plus a live ETA chip. ETA is recomputed on every GPS fix (cheap haversine), so it counts down
 * smoothly without hitting the Directions API.
 */
export function LiveTrackingMap({ ride, position, channel, className }: LiveTrackingMapProps) {
  const heading = position?.heading ?? ride.driver_profile?.current_heading ?? 0;

  const drivers = useMemo<NearbyDriverMarker[]>(
    () => (position ? [{ id: 'assigned-driver', lat: position.lat, lng: position.lng, heading, vehicleType: ride.ride_type, distanceKm: 0 }] : []),
    [position, heading, ride.ride_type],
  );

  const stops = ride.stops;
  const finalStop = { lat: ride.dropoff_lat, lng: ride.dropoff_lng };
  const pickup = { lat: ride.pickup_lat, lng: ride.pickup_lng };

  const headline = useMemo(() => {
    if (ride.status === 'driver_arriving') return { title: 'Your driver has arrived', detail: 'Meet them at the pickup point.' };
    if (!position) return { title: 'Locating your driver…', detail: 'Their position appears as soon as it is shared.' };

    const toPickup = ride.status === 'accepted';
    const eta = estimateEta(position, toPickup ? pickup : finalStop, position.speedKmh);
    return {
      title: toPickup ? `Arriving in ~${eta.minutes} min` : `Drop-off in ~${eta.minutes} min`,
      detail: `${formatDistance(eta.distanceKm)} ${toPickup ? 'away from your pickup' : 'to your destination'}`,
    };
    // pickup/finalStop are derived from primitives on `ride`; depend on those directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.status, position, ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng]);

  const live = channel !== 'polling';

  return (
    <section className={cn('relative overflow-hidden rounded-3xl border border-border bg-muted shadow-soft', className)} aria-label="Live map">
      <div className="relative h-64 sm:h-80">
        <BookingMap
          className="absolute inset-0"
          pickup={{ address: ride.pickup_address, ...pickup }}
          dropoff={{ address: ride.dropoff_address, ...finalStop }}
          stops={stops}
          polyline={ride.route_polyline}
          drivers={drivers}
          fitDrivers
        />

        <span
          className={cn(
            'absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lift backdrop-blur',
            live ? 'border-success/30 bg-background/90 text-success' : 'border-amber-500/30 bg-background/90 text-amber-600 dark:text-amber-400',
          )}
          role="status"
        >
          {live ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" aria-hidden /> Updating every few seconds
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {ride.status === 'driver_arriving' ? <MapPin className="h-5 w-5" aria-hidden /> : position ? <Clock className="h-5 w-5" aria-hidden /> : <Radio className="h-5 w-5" aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-extrabold leading-tight">{headline.title}</p>
          <p className="truncate text-sm text-muted-foreground">{headline.detail}</p>
        </div>
      </div>
    </section>
  );
}
