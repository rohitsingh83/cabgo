'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useNow } from '@/hooks/use-now';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { getCancellationPolicy } from '@/lib/rides/cancellation';
import { cn, formatCurrency } from '@/lib/utils';
import type { CancelRideResult, Ride } from '@/types';

const REASONS = [
  'Changed my plans',
  'Driver is taking too long',
  'Booked by mistake',
  'Wrong pickup or drop-off',
  'Found another ride',
] as const;

interface CancelRideDialogProps {
  ride: Pick<Ride, 'id' | 'status' | 'driver_id' | 'accepted_at'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (result: CancelRideResult) => void;
}

/** Confirmation with a live free-cancellation countdown (same policy function as the server). */
export function CancelRideDialog({ ride, open, onOpenChange, onCancelled }: CancelRideDialogProps) {
  const now = useNow(1000);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setReason(REASONS[0]);
  }, [open]);

  const policy = getCancellationPolicy(ride, now);
  const minutes = Math.floor(policy.freeSecondsLeft / 60);
  const seconds = String(policy.freeSecondsLeft % 60).padStart(2, '0');

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await apiFetch<CancelRideResult>(`/api/rides/${ride.id}/cancel`, {
        method: 'POST',
        body: { reason },
      });
      toast({
        title: 'Ride cancelled',
        description: result.cancellationFee > 0 ? `A cancellation fee of ${formatCurrency(result.cancellationFee)} applies.` : 'No charge.',
      });
      onOpenChange(false);
      onCancelled(result);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not cancel',
        description: error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.',
      });
      // The ride may have moved on (e.g. trip started) — close so the page can refresh its state.
      if (error instanceof ApiClientError && error.status === 409) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this ride?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {policy.canCancel ? (
                policy.isFree ? (
                  <p className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <span>
                      {policy.freeSecondsLeft > 0 ? (
                        <>
                          Free cancellation for another{' '}
                          <strong className="tabular-nums">
                            {minutes}:{seconds}
                          </strong>
                          .
                        </>
                      ) : (
                        'Cancelling now is free — no driver has been assigned.'
                      )}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    <span>
                      The free cancellation window has passed. A <strong>{formatCurrency(policy.fee)}</strong> fee applies because your driver is
                      already on the way.
                    </span>
                  </p>
                )
              ) : (
                <p className="text-sm">{policy.blockedReason}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {policy.canCancel && (
          <fieldset className="space-y-2" disabled={submitting}>
            <legend className="mb-2 text-sm font-semibold">Why are you cancelling?</legend>
            {REASONS.map((item) => (
              <label
                key={item}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm transition-colors',
                  reason === item ? 'border-brand bg-brand/5 font-semibold' : 'border-border hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={item}
                  checked={reason === item}
                  onChange={() => setReason(item)}
                  className="h-4 w-4 accent-[hsl(var(--brand))]"
                />
                {item}
              </label>
            ))}
          </fieldset>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={submitting} className="mt-0 h-11">
            Keep ride
          </AlertDialogCancel>
          {policy.canCancel && (
            <Button variant="destructive" className="h-11" onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" aria-hidden />}
              {policy.isFree ? 'Cancel ride' : `Cancel · ${formatCurrency(policy.fee)} fee`}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
