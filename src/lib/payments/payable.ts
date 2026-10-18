import { roundTo } from '@/lib/utils';
import type { PaymentKind, Ride } from '@/types';

type PayableRide = Pick<Ride, 'status' | 'final_fare' | 'estimated_fare' | 'cancellation_fee'>;

/**
 * What (if anything) a ride owes. Pure and client-safe so the UI and the server agree.
 * The SERVER is the only authority for the charged amount — it re-derives this from the database
 * and never reads an amount from the request.
 *  - completed trip       → the final fare
 *  - cancelled with a fee → the late-cancellation fee
 *  - anything else        → nothing is payable
 */
export function payableFor(ride: PayableRide): { amount: number; kind: PaymentKind } | null {
  if (ride.status === 'completed') {
    const amount = roundTo(Number(ride.final_fare ?? ride.estimated_fare));
    return amount > 0 ? { amount, kind: 'fare' } : null;
  }
  if (ride.status === 'cancelled') {
    const fee = roundTo(Number(ride.cancellation_fee));
    return fee > 0 ? { amount: fee, kind: 'cancellation_fee' } : null;
  }
  return null;
}
