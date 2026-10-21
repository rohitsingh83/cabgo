'use client';

import { useCallback, useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import { AlertCircle, Banknote, CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';

import { CheckoutForm } from '@/components/payment/CheckoutForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { getStripePromise, isStripeClientConfigured } from '@/lib/stripe/client';
import { formatCurrency } from '@/lib/utils';
import type { ConfirmPaymentResult, PaymentIntentResult } from '@/types';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  onResult: (result: ConfirmPaymentResult) => void;
}

type IntentState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; intent: PaymentIntentResult }
  | { status: 'error'; message: string };

/** Stripe Elements theme that matches CabGo's palette in both colour modes. */
function appearanceFor(dark: boolean): Appearance {
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: '#2563EB',
      colorBackground: dark ? '#111111' : '#ffffff',
      colorText: dark ? '#fafafa' : '#0a0a0a',
      colorDanger: '#ef4444',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      borderRadius: '12px',
      spacingUnit: '4px',
    },
  };
}

/**
 * Modal that asks the server for a PaymentIntent and renders Stripe's Payment Element.
 * The intent is (re)requested every time the dialog opens, so a stale client secret is never reused.
 */
export function PaymentDialog({ open, onOpenChange, rideId, onResult }: PaymentDialogProps) {
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<IntentState>({ status: 'idle' });
  const configured = isStripeClientConfigured();

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const intent = await apiFetch<PaymentIntentResult>('/api/payments/create-intent', {
        method: 'POST',
        body: { rideId },
      });
      setState({ status: 'ready', intent });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'Could not start the payment. Please try again.',
      });
    }
  }, [rideId]);

  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);

  const handleCashPayment = async () => {
    setCashSubmitting(true);
    setCashError(null);
    try {
      const result = await apiFetch<ConfirmPaymentResult>('/api/payments/cash', {
        method: 'POST',
        body: { rideId },
      });
      handleResult(result);
    } catch (err) {
      setCashError(
        err instanceof ApiClientError ? err.message : 'Failed to complete cash payment.',
      );
    } finally {
      setCashSubmitting(false);
    }
  };

  useEffect(() => {
    if (open && configured) void load();
    if (!open) {
      setState({ status: 'idle' });
      setCashError(null);
    }
  }, [open, configured, load]);

  const handleResult = (result: ConfirmPaymentResult) => {
    onResult(result);
    // Close on success or "bank still confirming"; keep it open on a decline so the card can be corrected.
    if (result.state === 'completed' || result.state === 'processing') onOpenChange(false);
  };

  const dark = resolvedTheme === 'dark';
  const title =
    state.status === 'ready' && state.intent.kind === 'cancellation_fee'
      ? 'Pay cancellation fee'
      : 'Pay for your ride';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">{title}</DialogTitle>
          <DialogDescription>
            {state.status === 'ready' ? (
              <>
                You&apos;re paying{' '}
                <strong className="text-foreground">
                  {formatCurrency(state.intent.amount, state.intent.currency)}
                </strong>{' '}
                by card, UPI, wallet or cash.
              </>
            ) : (
              'Choose how you want to pay.'
            )}
          </DialogDescription>
        </DialogHeader>

        {!configured && (
          <div className="space-y-4">
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
            >
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
              <p>
                Online card gateway is not enabled. You can complete this payment directly using
                Cash or Demo settlement.
              </p>
            </div>

            {cashError && (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {cashError}
              </div>
            )}

            <Button
              className="h-12 w-full gap-2 font-semibold text-base"
              onClick={handleCashPayment}
              disabled={cashSubmitting}
            >
              {cashSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Banknote className="h-5 w-5" />
              )}
              Pay with Cash / Demo
            </Button>
          </div>
        )}

        {configured && state.status === 'loading' && (
          <div className="space-y-3" aria-busy aria-label="Preparing secure payment">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {configured && state.status === 'error' && (
          <div role="alert" className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{state.message}</span>
            </div>
            <Button variant="outline" className="h-11 w-full" onClick={() => void load()}>
              <RefreshCw aria-hidden /> Try again
            </Button>
          </div>
        )}

        {configured && state.status === 'ready' && (
          <Elements
            // Re-mount when the intent or the colour mode changes (Elements options are immutable).
            key={`${state.intent.paymentId}-${dark ? 'd' : 'l'}`}
            stripe={getStripePromise()}
            options={{
              clientSecret: state.intent.clientSecret,
              appearance: appearanceFor(dark),
              locale: 'en',
            }}
          >
            <CheckoutForm
              rideId={rideId}
              amount={state.intent.amount}
              currency={state.intent.currency}
              onResult={handleResult}
            />
          </Elements>
        )}

        {configured &&
          (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_test_') &&
          state.status === 'ready' && (
            <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
              Test mode · use card{' '}
              <span className="font-mono font-semibold text-foreground">4242 4242 4242 4242</span>,
              any future date, any CVC.
            </p>
          )}

        {configured && state.status === 'ready' && (
          <div className="pt-2 border-t border-border">
            <Button
              variant="outline"
              className="h-10 w-full gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={handleCashPayment}
              disabled={cashSubmitting}
            >
              {cashSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-4 w-4" />}
              Pay with Cash instead
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
