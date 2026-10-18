'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Hourglass,
  Loader2,
  Lock,
  Receipt,
  RotateCcw,
  Wallet,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { payableFor } from '@/lib/payments/payable';
import { methodLabel } from '@/lib/payments/format';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import type { CheckoutSessionResult, ConfirmPaymentResult, RideWithRelations } from '@/types';

/** Stripe Elements are only needed once the rider taps Pay, so they stay out of the page's first-load bundle. */
const PaymentDialog = dynamic(
  () => import('@/components/payment/PaymentDialog').then((m) => m.PaymentDialog),
  { ssr: false },
);

/** Query params Stripe/Checkout append when sending the rider back to the tracking page. */
export interface PaymentReturn {
  paymentIntentId?: string;
  sessionId?: string;
  checkoutCancelled?: boolean;
}

interface PaymentPanelProps {
  ride: RideWithRelations;
  /** Re-fetch the ride (the parent owns the ride state). */
  onUpdated: () => void;
  paymentReturn?: PaymentReturn;
}

const PROCESSING_POLL_MS = 5000;
const PROCESSING_MAX_POLLS = 60; // 5 minutes

/**
 * Pay-after-ride card shown on the tracking screen for completed rides and for cancellations that
 * carry a fee. Handles four situations: due, failed (retry), processing (bank still confirming),
 * and paid/refunded. Money amounts come from the ride row; the server re-derives them anyway.
 */
export function PaymentPanel({ ride, onUpdated, paymentReturn }: PaymentPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  // Mount the dialog (and download Stripe Elements) only after the first tap on Pay.
  const [dialogMounted, setDialogMounted] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [returnBusy, setReturnBusy] = useState(
    Boolean(paymentReturn?.paymentIntentId || paymentReturn?.sessionId),
  );
  const handledReturn = useRef(false);

  const payable = payableFor(ride);
  const payment = ride.payment;

  const handleResult = useCallback(
    (result: ConfirmPaymentResult) => {
      if (result.state === 'completed') {
        toast({
          variant: 'success',
          title: 'Payment successful',
          description: 'A receipt has been sent to your email.',
        });
        setProcessing(false);
      } else if (result.state === 'processing') {
        toast({
          title: 'Payment processing',
          description: result.message ?? 'We will notify you once it clears.',
        });
        setProcessing(true);
      } else if (result.state === 'failed') {
        toast({
          variant: 'destructive',
          title: 'Payment failed',
          description: result.message ?? 'The payment was declined.',
        });
      }
      onUpdated();
    },
    [onUpdated],
  );

  // Back from a 3-D Secure / UPI redirect or from Stripe Checkout → verify with the server once.
  useEffect(() => {
    if (!paymentReturn || handledReturn.current) return;
    handledReturn.current = true;
    // Strip the Stripe query params so a refresh does not re-run this.
    window.history.replaceState(null, '', window.location.pathname);

    if (paymentReturn.checkoutCancelled) {
      toast({
        title: 'Checkout cancelled',
        description: 'No money was taken. You can pay whenever you are ready.',
      });
      return;
    }
    const body = paymentReturn.paymentIntentId
      ? { paymentIntentId: paymentReturn.paymentIntentId }
      : paymentReturn.sessionId
        ? { sessionId: paymentReturn.sessionId }
        : null;
    if (!body) return;

    apiFetch<ConfirmPaymentResult>('/api/payments/confirm', { method: 'POST', body })
      .then(handleResult)
      .catch((error: unknown) => {
        toast({
          variant: 'destructive',
          title: 'Could not verify your payment',
          description:
            error instanceof ApiClientError ? error.message : 'Please refresh in a moment.',
        });
      })
      .finally(() => setReturnBusy(false));
  }, [paymentReturn, handleResult]);

  // While the bank is confirming (UPI/net-banking), poll until the webhook settles the payment.
  const settled =
    payment?.status === 'completed' ||
    payment?.status === 'refunded' ||
    payment?.status === 'failed';
  useEffect(() => {
    if (!processing) return;
    if (settled) {
      setProcessing(false);
      return;
    }
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > PROCESSING_MAX_POLLS) {
        clearInterval(timer);
        setProcessing(false);
        return;
      }
      onUpdated();
    }, PROCESSING_POLL_MS);
    return () => clearInterval(timer);
  }, [processing, settled, onUpdated]);

  const startCheckout = async () => {
    setCheckoutBusy(true);
    try {
      const { url } = await apiFetch<CheckoutSessionResult>('/api/payments/checkout', {
        method: 'POST',
        body: { rideId: ride.id },
      });
      window.location.assign(url);
    } catch (error) {
      setCheckoutBusy(false);
      toast({
        variant: 'destructive',
        title: 'Could not open Checkout',
        description:
          error instanceof ApiClientError
            ? error.message
            : 'Something went wrong. Please try again.',
      });
      onUpdated();
    }
  };

  if (!payable && !payment) return null;
  const amount = payment ? Number(payment.amount) : (payable?.amount ?? 0);
  const currency = payment?.currency;
  const isFee = ride.status === 'cancelled';

  /* ----------------------------------------------------------------- paid */
  if (payment?.status === 'completed') {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        aria-label="Payment"
        className="overflow-hidden rounded-2xl border border-success/30 bg-gradient-to-br from-success/15 via-card to-card p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success text-white shadow-glow-green">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-extrabold">
              {isFee ? 'Cancellation fee paid' : 'Payment complete'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(amount, currency)} · {methodLabel(payment.payment_method)} ·{' '}
              {formatDateTime(payment.updated_at)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/rider/payments/${payment.id}`}
            className={cn(buttonVariants({ variant: 'outline' }), 'h-11 flex-1')}
          >
            <Receipt aria-hidden /> View receipt
          </Link>
        </div>
      </motion.section>
    );
  }

  /* ------------------------------------------------------------- refunded */
  if (payment?.status === 'refunded') {
    return (
      <section
        aria-label="Payment"
        className="flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/10 p-5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
          <RotateCcw className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-extrabold">Refunded</h2>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(amount, currency)} is returning to your original payment method (5–7
            business days).
          </p>
          <Link
            href={`/rider/payments/${payment.id}`}
            className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand hover:underline"
          >
            View receipt
          </Link>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------ due */
  const failed = payment?.status === 'failed';
  const busy = returnBusy || checkoutBusy;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Payment"
      className="relative overflow-hidden rounded-2xl border border-border bg-black p-5 text-white shadow-lift dark:border-white/10"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand/40 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/60">
          <Wallet className="h-4 w-4" aria-hidden />{' '}
          {isFee ? 'Cancellation fee due' : 'Payment due'}
        </div>
        <p className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">
          {formatCurrency(amount, currency)}
        </p>
        <p className="mt-1 text-sm text-white/60">
          {isFee
            ? 'Charged because the ride was cancelled after the free window.'
            : 'Pay now to get your receipt and book your next ride.'}
        </p>

        {failed && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2.5 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {payment?.failure_reason ?? 'Your last payment attempt failed.'} Try again or use
              another method.
            </span>
          </div>
        )}

        {(processing || returnBusy) && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white/90"
          >
            {returnBusy ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Hourglass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>
              {returnBusy
                ? 'Confirming your payment…'
                : 'Your bank is confirming the payment. This screen updates automatically.'}
            </span>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <Button
            variant="brand"
            size="xl"
            className="h-14 w-full text-base"
            onClick={() => {
              setDialogMounted(true);
              setDialogOpen(true);
            }}
            disabled={busy || processing}
          >
            <Lock aria-hidden /> {failed ? 'Try again' : 'Pay'} {formatCurrency(amount, currency)}
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => void startCheckout()}
            disabled={busy || processing}
          >
            {checkoutBusy ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ExternalLink aria-hidden />
            )}
            Pay on Stripe Checkout
          </Button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/50">
          <Lock className="h-3 w-3" aria-hidden /> Secured by Stripe · Cards, UPI &amp; wallets
        </p>
      </div>

      {dialogMounted && (
        <PaymentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          rideId={ride.id}
          onResult={handleResult}
        />
      )}
    </motion.section>
  );
}
