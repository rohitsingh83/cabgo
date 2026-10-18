import { BUSINESS_RULES } from '@/lib/constants';
import type { Ride } from '@/types';

/**
 * Cancellation policy — pure, so the server (authoritative) and the UI (live countdown)
 * always agree.
 *
 *  • Still searching / no driver yet ........ always free
 *  • Driver assigned, within the window ..... free (default 2 minutes from acceptance)
 *  • Driver assigned, window elapsed ........ flat fee (BUSINESS_RULES.cancellationFee)
 *  • Trip in progress ....................... not cancellable by the rider
 */
export interface CancellationPolicy {
  canCancel: boolean;
  isFree: boolean;
  /** Fee that will be charged if the rider cancels right now. */
  fee: number;
  /** Seconds left in the free window (0 when elapsed or not applicable). */
  freeSecondsLeft: number;
  /** Why cancelling is blocked (when `canCancel` is false). */
  blockedReason?: string;
}

type PolicyRide = Pick<Ride, 'status' | 'driver_id' | 'accepted_at'>;

export function getCancellationPolicy(ride: PolicyRide, now: Date = new Date()): CancellationPolicy {
  const { freeCancellationSeconds, cancellationFee } = BUSINESS_RULES;

  switch (ride.status) {
    case 'requested':
    case 'searching':
      return { canCancel: true, isFree: true, fee: 0, freeSecondsLeft: 0 };

    case 'accepted':
    case 'driver_arriving': {
      const acceptedAt = ride.accepted_at ? new Date(ride.accepted_at).getTime() : now.getTime();
      const elapsed = Math.max(0, Math.floor((now.getTime() - acceptedAt) / 1000));
      const left = Math.max(0, freeCancellationSeconds - elapsed);
      return left > 0
        ? { canCancel: true, isFree: true, fee: 0, freeSecondsLeft: left }
        : { canCancel: true, isFree: false, fee: cancellationFee, freeSecondsLeft: 0 };
    }

    case 'in_progress':
      return {
        canCancel: false,
        isFree: false,
        fee: 0,
        freeSecondsLeft: 0,
        blockedReason: 'Your trip has already started. Ask your driver to end it, or contact support.',
      };

    default:
      return {
        canCancel: false,
        isFree: false,
        fee: 0,
        freeSecondsLeft: 0,
        blockedReason: 'This ride is already finished.',
      };
  }
}
