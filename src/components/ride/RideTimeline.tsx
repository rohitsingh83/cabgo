import { Check, X } from 'lucide-react';

import { cn, formatTime } from '@/lib/utils';
import type { Ride } from '@/types';

type TimelineRide = Pick<
  Ride,
  'status' | 'created_at' | 'accepted_at' | 'started_at' | 'completed_at' | 'cancelled_at' | 'driver_id'
>;

interface Step {
  key: string;
  label: string;
  at: string | null;
  /** Position in the happy path; a step is done when the ride has reached it. */
  rank: number;
}

const RANK: Record<Ride['status'], number> = {
  requested: 0,
  searching: 0,
  accepted: 1,
  driver_arriving: 2,
  in_progress: 3,
  completed: 4,
  cancelled: -1,
};

/** Vertical progress list: requested → driver assigned → arriving → on trip → completed / cancelled. */
export function RideTimeline({ ride }: { ride: TimelineRide }) {
  const cancelled = ride.status === 'cancelled';
  // A cancelled ride "got as far as" the driver assignment if one was made.
  const reached = cancelled ? (ride.accepted_at ? 1 : 0) : RANK[ride.status];

  const steps: Step[] = [
    { key: 'requested', label: 'Ride requested', at: ride.created_at, rank: 0 },
    { key: 'accepted', label: 'Driver assigned', at: ride.accepted_at, rank: 1 },
    { key: 'arriving', label: 'Driver arriving', at: null, rank: 2 },
    { key: 'started', label: 'Trip started', at: ride.started_at, rank: 3 },
    { key: 'completed', label: 'Trip completed', at: ride.completed_at, rank: 4 },
  ];

  return (
    <ol className="space-y-0" aria-label="Ride progress">
      {steps.map((step, index) => {
        const done = step.rank <= reached;
        const current = !cancelled && step.rank === reached && ride.status !== 'completed';
        const last = index === steps.length - 1 && !cancelled;
        return (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={current ? 'step' : undefined}>
            {!last && (
              <span
                aria-hidden
                className={cn('absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5', done && step.rank < reached ? 'bg-success' : 'bg-border')}
              />
            )}
            <span
              className={cn(
                'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                done ? 'border-success bg-success text-white' : 'border-border bg-background',
                current && 'ring-4 ring-success/25',
              )}
              aria-hidden
            >
              {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <div className="flex flex-1 items-baseline justify-between gap-3">
              <span className={cn('text-sm', done ? 'font-semibold' : 'text-muted-foreground', current && 'text-foreground')}>
                {step.label}
              </span>
              {step.at && <span className="text-xs tabular-nums text-muted-foreground">{formatTime(step.at)}</span>}
            </div>
          </li>
        );
      })}

      {cancelled && (
        <li className="relative flex gap-3 pt-5">
          <span className="absolute -top-0 left-[11px] h-5 w-0.5 bg-border" aria-hidden />
          <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white" aria-hidden>
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <div className="flex flex-1 items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-destructive">Ride cancelled</span>
            {ride.cancelled_at && <span className="text-xs tabular-nums text-muted-foreground">{formatTime(ride.cancelled_at)}</span>}
          </div>
        </li>
      )}
    </ol>
  );
}
