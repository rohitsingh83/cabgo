'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { cn, formatCurrency } from '@/lib/utils';

const REASONS = [
  { value: 'requested_by_customer', label: 'Customer request' },
  { value: 'duplicate', label: 'Duplicate charge' },
  { value: 'fraudulent', label: 'Fraudulent' },
] as const;

/** Full refund of a settled payment through Stripe. Refunds cannot be undone, so it asks first. */
export function RefundButton({ paymentId, amount, compact }: { paymentId: string; amount: number; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]['value']>('requested_by_customer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refund = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/payments/${paymentId}/refund`, { method: 'POST', body: { reason } });
      toast({ variant: 'success', title: 'Refund issued', description: `${formatCurrency(amount)} is on its way back to the rider.` });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'The refund could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size={compact ? 'sm' : 'default'} className={cn(compact ? 'h-11' : 'h-11', 'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive')} onClick={() => setOpen(true)}>
        <RotateCcw aria-hidden /> Refund
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund {formatCurrency(amount)}?</AlertDialogTitle>
            <AlertDialogDescription>The full amount goes back to the rider&apos;s original payment method through Stripe. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="mb-1 text-sm font-semibold">Reason</legend>
            <div role="radiogroup" aria-label="Refund reason" className="flex flex-wrap gap-2">
              {REASONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={reason === option.value}
                  onClick={() => setReason(option.value)}
                  className={cn('min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', reason === option.value ? 'border-brand bg-brand text-white' : 'border-border hover:border-brand/60')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy} className="mt-0 h-11">
              Keep payment
            </AlertDialogCancel>
            <Button variant="destructive" className="h-11" onClick={() => void refund()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />} Refund {formatCurrency(amount)}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
