import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { RIDE_STATUS_CONFIG } from '@/lib/constants';
import type { Ride } from '@/types';

interface ActiveRideBannerProps {
  ride: Pick<Ride, 'id' | 'status' | 'pickup_address' | 'dropoff_address'>;
}

/** Prominent "you have a ride in progress" strip linking to the tracking page. */
export function ActiveRideBanner({ ride }: ActiveRideBannerProps) {
  return (
    <Link
      href={`/rider/tracking/${ride.id}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl bg-black p-4 text-white shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border dark:border-white/10 sm:p-5"
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/40 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-success/25 blur-3xl" />

      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
      </span>

      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Ride in progress</p>
          <RideStatusBadge status={ride.status} className="border-white/20" />
        </div>
        <p className="mt-1 truncate font-display text-base font-extrabold sm:text-lg">{ride.dropoff_address}</p>
        <p className="truncate text-xs text-white/60">{RIDE_STATUS_CONFIG[ride.status].description}</p>
      </div>

      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform group-hover:translate-x-1">
        <ArrowRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}
