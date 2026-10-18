import { Car, ChevronRight, Phone, Star } from 'lucide-react';

import { DriverProfileSheet } from '@/components/rating/DriverProfileSheet';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RideWithRelations } from '@/types';

interface DriverCardProps {
  driver: NonNullable<RideWithRelations['driver']>;
  profile: RideWithRelations['driver_profile'];
  className?: string;
}

/** Assigned driver: avatar, rating, vehicle and a license-plate style number. */
export function DriverCard({ driver, profile, className }: DriverCardProps) {
  const rating = profile?.average_rating ?? 0;

  return (
    <section className={cn('rounded-2xl border border-border bg-card p-4', className)} aria-label="Your driver">
      <div className="flex items-center gap-3">
        <UserAvatar name={driver.full_name} src={driver.avatar_url} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold">{driver.full_name}</p>
          <DriverProfileSheet driverId={driver.id}>
            <button
              type="button"
              aria-label={`View ${driver.full_name}'s ratings and reviews`}
              className="-my-2 flex min-h-[44px] items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-semibold text-foreground">{rating > 0 ? rating.toFixed(2) : 'New'}</span>
              {profile && profile.total_rides > 0 && <span>· {profile.total_rides.toLocaleString('en-IN')} rides</span>}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </DriverProfileSheet>
        </div>
        {driver.phone && (
          <a
            href={`tel:${driver.phone}`}
            aria-label={`Call ${driver.full_name}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'rounded-full')}
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>

      {profile && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted/60 p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Car className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="truncate text-sm">
              <span className="font-semibold">{profile.vehicle_model}</span>
              {profile.vehicle_color && <span className="text-muted-foreground"> · {profile.vehicle_color}</span>}
            </p>
          </div>
          <span className="shrink-0 rounded-md border-2 border-foreground/80 bg-background px-2.5 py-1 font-mono text-sm font-bold uppercase tracking-wider">
            {profile.vehicle_plate}
          </span>
        </div>
      )}
    </section>
  );
}
