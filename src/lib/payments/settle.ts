import 'server-only';

import type Stripe from 'stripe';

import { sendEmail } from '@/lib/email';
import { renderReceiptHtml, renderReceiptText } from '@/lib/email/receipt';
import { createNotifications, type NewNotification } from '@/lib/notifications';
import { getReceiptData } from '@/lib/payments/receipt';
import { publishRideEvent } from '@/lib/rides/realtime';
import { getStripe } from '@/lib/stripe/server';
import { toMinorUnits } from '@/lib/stripe/amounts';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { uuidSchema } from '@/lib/validations';
import { absoluteUrl, formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types';

/*
 * ======================================================================================
 *  Settlement — the single code path that turns a Stripe result into a `payments` update.
 *
 *  Three things can report the same payment: the browser (POST /api/payments/confirm), the
 *  Stripe webhook, and the Checkout return page. They race, so every transition is a CONDITIONAL
 *  update (`… where status in ('pending','failed')`). Only the caller whose update actually
 *  changes the row runs the side effects (notifications, receipt email), which makes the whole
 *  thing idempotent without a separate events table.
 * ======================================================================================
 */

export interface SettleOutcome {
  payment: Payment | null;
  intent: Stripe.PaymentIntent;
}

async function loadPayment(
  column: 'id' | 'stripe_payment_intent_id',
  value: string,
): Promise<Payment | null> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('payments').select('*').eq(column, value).maybeSingle();
  if (error) throw new Error(`Failed to load payment: ${error.message}`);
  return data;
}

/** Match a Stripe PaymentIntent to our row: metadata first (works for Checkout-created intents), then by id. */
export async function findPaymentForIntent(intent: Stripe.PaymentIntent): Promise<Payment | null> {
  const metaId = uuidSchema.safeParse(intent.metadata?.payment_id);
  if (metaId.success) {
    const byMeta = await loadPayment('id', metaId.data);
    if (byMeta) return byMeta;
  }
  return loadPayment('stripe_payment_intent_id', intent.id);
}

/** Money was taken twice (e.g. the rider paid inline AND on Checkout in two tabs) → give the extra charge back. */
async function refundDuplicate(intent: Stripe.PaymentIntent): Promise<void> {
  try {
    await getStripe().refunds.create(
      { payment_intent: intent.id, reason: 'duplicate', metadata: { cause: 'duplicate_payment' } },
      { idempotencyKey: `dup_refund_${intent.id}` },
    );
    console.warn(`[payments] refunded duplicate charge ${intent.id}`);
  } catch (error) {
    console.error(
      `[payments] FAILED to refund duplicate charge ${intent.id} — refund manually:`,
      error,
    );
  }
}

/** Notifications, realtime nudge and receipt email after a payment turns `completed`. Never throws. */
export async function onPaymentCompleted(payment: Payment): Promise<void> {
  const db = createSupabaseAdminClient();
  try {
    const { data: ride } = await db
      .from('rides')
      .select('id, rider_id, driver_id, status, cancellation_reason, dropoff_address')
      .eq('id', payment.ride_id)
      .maybeSingle();
    const isFee = ride?.status === 'cancelled';

    const items: NewNotification[] = [
      {
        userId: payment.rider_id,
        type: 'payment_received',
        title: isFee ? 'Cancellation fee paid' : 'Payment successful',
        message: `${formatCurrency(Number(payment.amount), payment.currency)} paid${ride ? ` for your ride to ${ride.dropoff_address}` : ''}.`,
        data: {
          rideId: payment.ride_id,
          paymentId: payment.id,
          url: `/rider/payments/${payment.id}`,
        },
      },
    ];
    if (payment.driver_id && Number(payment.driver_earnings) > 0) {
      items.push({
        userId: payment.driver_id,
        type: 'payment_received',
        title: 'You got paid',
        message: `${formatCurrency(Number(payment.driver_earnings), payment.currency)} was added to your earnings.`,
        data: { rideId: payment.ride_id, paymentId: payment.id, url: '/driver/earnings' },
      });
    }
    await createNotifications(items);

    // Tell the open tracking screens (rider + driver) to refresh: the ride now has a settled payment.
    if (ride) await publishRideEvent(ride, 'ride:status');
  } catch (error) {
    console.error('[payments] post-payment notifications failed:', error);
  }

  try {
    const data = await getReceiptData(payment.id);
    if (!data?.receipt.rider.email) return;
    const sent = await sendEmail({
      to: data.receipt.rider.email,
      subject: `Your CabGo receipt ${data.receipt.number} · ${formatCurrency(Number(payment.amount), payment.currency)}`,
      html: renderReceiptHtml(data.receipt, {
        appUrl: absoluteUrl(`/rider/payments/${payment.id}`),
      }),
      text: renderReceiptText(data.receipt),
    });
    if (sent) {
      await db
        .from('payments')
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq('id', payment.id);
    }
  } catch (error) {
    console.error('[payments] receipt email failed:', error);
  }
}

/**
 * Re-read a PaymentIntent from Stripe (never trust the client or a stale webhook payload) and, if it
 * succeeded, mark our payment `completed`.
 */
export async function settlePaymentIntent(intentId: string): Promise<SettleOutcome> {
  const stripe = getStripe();
  const db = createSupabaseAdminClient();
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });

  const payment = await findPaymentForIntent(intent);
  if (!payment) {
    console.error(`[payments] intent ${intent.id} does not match any payment row`);
    return { payment: null, intent };
  }
  if (intent.status !== 'succeeded') return { payment, intent };

  if (payment.status === 'completed') {
    if (payment.stripe_payment_intent_id && payment.stripe_payment_intent_id !== intent.id)
      await refundDuplicate(intent);
    return { payment, intent };
  }
  if (payment.status === 'refunded') return { payment, intent };

  // The amount Stripe collected must equal what we asked for. A mismatch means the intent was altered
  // out-of-band; refuse to mark the ride paid and leave it for manual review.
  if (intent.amount_received !== toMinorUnits(Number(payment.amount), payment.currency)) {
    console.error(
      `[payments] amount mismatch for ${payment.id}: Stripe ${intent.amount_received} vs expected ${payment.amount}`,
    );
    return { payment, intent };
  }

  const charge =
    typeof intent.latest_charge === 'object' && intent.latest_charge ? intent.latest_charge : null;
  const { data: updated, error } = await db
    .from('payments')
    .update({
      status: 'completed',
      stripe_payment_intent_id: intent.id,
      stripe_charge_id:
        charge?.id ?? (typeof intent.latest_charge === 'string' ? intent.latest_charge : null),
      payment_method: charge?.payment_method_details?.type ?? 'card',
      receipt_url: charge?.receipt_url ?? null,
      failure_reason: null,
    })
    .eq('id', payment.id)
    .in('status', ['pending', 'failed'])
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to complete payment: ${error.message}`);

  if (!updated) {
    // Lost the race: another request completed it first (and runs the side effects).
    return { payment: (await loadPayment('id', payment.id)) ?? payment, intent };
  }

  await onPaymentCompleted(updated);
  return { payment: updated, intent };
}

/** A Checkout Session that was paid → settle the PaymentIntent it created. */
export async function settleCheckoutSession(sessionId: string): Promise<SettleOutcome | null> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const intentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!intentId || session.payment_status === 'unpaid') return null;
  return settlePaymentIntent(intentId);
}

/** pending → failed (with Stripe's human-readable reason) and tell the rider once. */
export async function failPayment(
  intent: Stripe.PaymentIntent,
  fallbackReason = 'The payment could not be completed.',
): Promise<Payment | null> {
  const payment = await findPaymentForIntent(intent);
  if (!payment || payment.status !== 'pending') return payment;

  const reason = intent.last_payment_error?.message ?? fallbackReason;
  const db = createSupabaseAdminClient();
  const { data: updated, error } = await db
    .from('payments')
    .update({ status: 'failed', failure_reason: reason })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to mark payment failed: ${error.message}`);

  if (updated) {
    await createNotifications([
      {
        userId: updated.rider_id,
        type: 'payment_failed',
        title: 'Payment failed',
        message: `${reason} Tap to try again.`,
        data: {
          rideId: updated.ride_id,
          paymentId: updated.id,
          url: `/rider/tracking/${updated.ride_id}`,
        },
      },
    ]);
  }
  return updated ?? payment;
}

/** completed → refunded. Idempotent (webhook + the admin refund call both land here). */
export async function markRefunded(paymentId: string): Promise<Payment | null> {
  const db = createSupabaseAdminClient();
  const { data: updated, error } = await db
    .from('payments')
    .update({ status: 'refunded' })
    .eq('id', paymentId)
    .eq('status', 'completed')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to mark payment refunded: ${error.message}`);

  if (updated) {
    await createNotifications([
      {
        userId: updated.rider_id,
        type: 'payment_received',
        title: 'Refund issued',
        message: `${formatCurrency(Number(updated.amount), updated.currency)} is on its way back to your original payment method.`,
        data: {
          rideId: updated.ride_id,
          paymentId: updated.id,
          url: `/rider/payments/${updated.id}`,
        },
      },
    ]);
    return updated;
  }
  return loadPayment('id', paymentId);
}
