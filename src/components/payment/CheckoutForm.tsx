'use client';

import { useState, type FormEvent } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { AlertCircle, Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import type { ConfirmPaymentResult } from '@/types';

interface CheckoutFormProps {
  rideId: string;
  amount: number;
  currency: string;
  onResult: (result: ConfirmPaymentResult) => void;
}

/**
 * Stripe Payment Element + submit button. Lives inside <Elements>.
 *
 * Flow: confirmPayment (card is charged / UPI intent opens) → if Stripe needs a redirect (3-D Secure
 * on some banks) it navigates away and comes back to the tracking page, which calls /confirm itself;
 * otherwise we call /confirm here so the server verifies the result before the UI says "paid".
 */
export function CheckoutForm({ rideId, amount, currency, onResult }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/rider/tracking/${rideId}` },
      redirect: 'if_required',
    });

    if (stripeError) {
      // Declines and validation problems are shown inline so the rider can fix the card and retry.
      setError(stripeError.message ?? 'The payment could not be completed.');
      setSubmitting(false);
      return;
    }

    if (!paymentIntent) {
      setError(
        'We could not read the payment result. Please check your payments before trying again.',
      );
      setSubmitting(false);
      return;
    }

    try {
      const result = await apiFetch<ConfirmPaymentResult>('/api/payments/confirm', {
        method: 'POST',
        body: { paymentIntentId: paymentIntent.id },
      });
      onResult(result);
      if (result.state === 'failed') setError(result.message ?? 'The payment was declined.');
    } catch (confirmError) {
      setError(
        confirmError instanceof ApiClientError
          ? confirmError.message
          : 'Your payment may have gone through. Check your payments page before paying again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="min-h-[180px]">
        {!ready && (
          <div className="space-y-3" aria-hidden>
            <div className="h-11 animate-pulse rounded-xl bg-muted" />
            <div className="h-11 animate-pulse rounded-xl bg-muted" />
            <div className="h-11 animate-pulse rounded-xl bg-muted" />
          </div>
        )}
        <PaymentElement
          options={{ layout: 'tabs' }}
          onReady={() => setReady(true)}
          onLoadError={() => setError('Could not load the secure payment form. Please try again.')}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        size="xl"
        className="h-14 w-full text-base"
        disabled={!stripe || !elements || !ready || submitting}
      >
        {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
        {submitting ? 'Processing…' : `Pay ${formatCurrency(amount, currency)}`}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" aria-hidden /> Payments are encrypted and processed by Stripe.
        CabGo never sees your card.
      </p>
    </form>
  );
}
