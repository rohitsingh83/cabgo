import { Badge } from '@/components/ui/badge';
import { RIDE_STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { RideStatus } from '@/types';

interface RideStatusBadgeProps {
  status: RideStatus;
  className?: string;
}

/** Coloured pill for a ride status. Live statuses get a pulsing dot. */
export function RideStatusBadge({ status, className }: RideStatusBadgeProps) {
  const config = RIDE_STATUS_CONFIG[status];
  const live = status === 'searching' || status === 'driver_arriving' || status === 'in_progress';

  return (
    <Badge variant={config.variant} className={cn('whitespace-nowrap', className)}>
      {live && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </Badge>
  );
}
