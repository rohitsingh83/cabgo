import 'server-only';

import type Stripe from 'stripe';

import { ApiError } from '@/lib/api';
import { CURRENCY } from '@/lib/constants';
import { payableFor, splitPayment } from '@/lib/payments/service';
import { markRefunded, settleCheckoutSession, settlePaymentIntent } from '@/lib/payments/settle';
import { MIN_CHARGE_MINOR, toMinorUnits } from '@/lib/stripe/amounts';
import { getStripe } from '@/lib/stripe/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { absoluteUrl } from '@/lib/utils';
import type {
  ConfirmPaymentResult,
  CheckoutSessionResult,
  Payment,
  PaymentIntentResult,
  PaymentKind,
  Ride,
  User,
} from '@/types';

/** Load the ride, make sure it belongs to the caller, and work out what it owes. */
async function loadPayableRide(
  user: Pick<User, 'id'>,
  rideId: string,
): Promise<{ ride: Ride; amount: number; kind: PaymentKind }> {
  const db = createSupabaseAdminClient();
  const { data: ride, error } = await db.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (error) throw new Error(`Failed to load ride: ${error.message}`);
  // 404 (not 403) so ride ids of other riders cannot be probed.
  if (!ride || ride.rider_id !== user.id) throw new ApiError(404, 'Ride not found.');

  const payable = payableFor(ride);
  if (!payable) throw new ApiError(409, 'There is nothing to pay for this ride.');
  if (toMinorUnits(payable.amount, CURRENCY) < MIN_CHARGE_MINOR)
    throw new ApiError(409, 'This amount is below the minimum chargeable amount.');
  return { ride, ...payable };
}

/**
 * Get-or-create the single live payment row of a ride and prepare it for a (new) attempt:
 * a `failed` row goes back to `pending`, and the amount/split are re-synced from the ride.
 * The partial unique index `payments_one_active_per_ride` guarantees there is never a second row;
 * a concurrent insert surfaces as 23505 and we simply re-read.
 */
async function ensurePaymentRow(ride: Ride, amount: number): Promise<Payment> {
  const db = createSupabaseAdminClient();
  const split = splitPayment(amount, Boolean(ride.driver_id));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: existing, error } = await db
      .from('payments')
      .select('*')
      .eq('ride_id', ride.id)
      .neq('status', 'refunded')
      .maybeSingle();
    if (error) throw new Error(`Failed to load payment: ${error.message}`);

    if (existing) {
      if (existing.status === 'completed') throw new ApiError(409, 'This ride is already paid.');
      const { data: reset, error: resetError } = await db
        .from('payments')
        .update({ status: 'pending', failure_reason: null, amount, currency: CURRENCY, ...split })
        .eq('id', existing.id)
        .in('status', ['pending', 'failed'])
        .select('*')
        .maybeSingle();
      if (resetError) throw new Error(`Failed to prepare payment: ${resetError.message}`);
      if (reset) return reset;
      continue; // changed under us (probably just completed) — re-read
    }

    const { data: created, error: insertError } = await db
      .from('payments')
      .insert({
        ride_id: ride.id,
        rider_id: ride.rider_id,
        driver_id: ride.driver_id,
        amount,
        currency: CURRENCY,
        status: 'pending',
        payment_method: 'card',
        ...split,
      })
      .select('*')
      .single();
    if (!insertError && created) return created;
    if (insertError?.code !== '23505')
      throw new Error(`Failed to create payment: ${insertError?.message ?? 'no row returned'}`);
  }
  throw new ApiError(409, 'Your payment is being prepared. Please try again in a moment.');
}

const describe = (kind: PaymentKind, ride: Ride): string =>
  kind === 'fare'
    ? `CabGo ride #${ride.id.slice(0, 8).toUpperCase()}`
    : `CabGo cancellation fee #${ride.id.slice(0, 8).toUpperCase()}`;

/**
 * Inline card/UPI payment: create (or reuse) the PaymentIntent for a ride and hand its client secret to
 * Stripe's Payment Element. The amount is computed here from the DB, never from the request.
 */
export async function createPaymentIntentForRide(
  user: Pick<User, 'id'>,
  rideId: string,
): Promise<PaymentIntentResult> {
  const stripe = getStripe();
  const { ride, amount, kind } = await loadPayableRide(user, rideId);
  const payment = await ensurePaymentRow(ride, amount);
  const minor = toMinorUnits(Number(payment.amount), payment.currency);

  let intent: Stripe.PaymentIntent | null = null;
  if (payment.stripe_payment_intent_id) {
    const existing = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    if (existing.status === 'succeeded') {
      await settlePaymentIntent(existing.id); // paid in another tab / the webhook is late — catch up
      throw new ApiError(409, 'This ride is already paid.');
    }
    if (existing.status === 'processing')
      throw new ApiError(
        409,
        'Your payment is still processing. We will notify you once it clears.',
      );
    if (existing.status !== 'canceled') {
      intent =
        existing.amount === minor
          ? existing
          : await stripe.paymentIntents.update(existing.id, { amount: minor });
    }
  }

  if (!intent) {
    intent = await stripe.paymentIntents.create(
      {
        amount: minor,
        currency: payment.currency,
        // Lets Stripe offer whatever methods are enabled in the dashboard (cards, UPI, wallets …).
        automatic_payment_methods: { enabled: true },
        description: describe(kind, ride),
        metadata: { ride_id: ride.id, payment_id: payment.id, rider_id: ride.rider_id, kind },
      },
      // Double-clicks / two tabs get the SAME intent instead of two competing ones.
      { idempotencyKey: `pi_${payment.id}_${minor}` },
    );
    const db = createSupabaseAdminClient();
    const { error } = await db
      .from('payments')
      .update({ stripe_payment_intent_id: intent.id })
      .eq('id', payment.id);
    if (error) throw new Error(`Failed to link payment intent: ${error.message}`);
  }

  if (!intent.client_secret)
    throw new Error('Stripe returned a PaymentIntent without a client secret');
  return {
    clientSecret: intent.client_secret,
    paymentId: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    kind,
  };
}

/** Hosted alternative: Stripe Checkout page (supports every method enabled on the account). */
export async function createCheckoutForRide(
  user: Pick<User, 'id' | 'email'>,
  rideId: string,
): Promise<CheckoutSessionResult> {
  const stripe = getStripe();
  const { ride, amount, kind } = await loadPayableRide(user, rideId);
  const payment = await ensurePaymentRow(ride, amount);
  const metadata = { ride_id: ride.id, payment_id: payment.id, rider_id: ride.rider_id, kind };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: ride.id,
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: toMinorUnits(Number(payment.amount), payment.currency),
          product_data: {
            name: kind === 'fare' ? 'CabGo ride' : 'CabGo cancellation fee',
            description: `${ride.pickup_address} → ${ride.dropoff_address}`.slice(0, 300),
          },
        },
      },
    ],
    // Copied onto the PaymentIntent Checkout creates, so the webhook can find our row.
    payment_intent_data: { metadata, description: describe(kind, ride) },
    metadata,
    success_url: `${absoluteUrl(`/rider/tracking/${ride.id}`)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${absoluteUrl(`/rider/tracking/${ride.id}`)}?checkout=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  if (!session.url) throw new Error('Stripe returned a Checkout Session without a URL');
  return { url: session.url };
}

/**
 * Called by the browser right after Stripe says "succeeded" (or after a redirect back). We ask Stripe
 * what really happened instead of believing the client, then settle through the shared path.
 */
export async function confirmPaymentForUser(
  user: Pick<User, 'id'>,
  input: { paymentIntentId: string } | { sessionId: string },
): Promise<ConfirmPaymentResult> {
  const stripe = getStripe();

  if ('sessionId' in input) {
    const session = await stripe.checkout.sessions.retrieve(input.sessionId);
    if (session.metadata?.rider_id !== user.id) throw new ApiError(404, 'Payment not found.');
    const outcome = await settleCheckoutSession(session.id);
    if (!outcome)
      return { state: 'pending', payment: null, message: 'The checkout was not completed.' };
    return toResult(outcome.payment, outcome.intent);
  }

  const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
  if (intent.metadata?.rider_id !== user.id) throw new ApiError(404, 'Payment not found.');
  const outcome = await settlePaymentIntent(intent.id);
  return toResult(outcome.payment, outcome.intent);
}

function toResult(payment: Payment | null, intent: Stripe.PaymentIntent): ConfirmPaymentResult {
  if (payment?.status === 'completed') return { state: 'completed', payment };
  if (intent.status === 'processing') {
    return {
      state: 'processing',
      payment,
      message:
        'Your bank is still confirming the payment. We will notify you as soon as it clears.',
    };
  }
  if (intent.last_payment_error || payment?.status === 'failed') {
    return {
      state: 'failed',
      payment,
      message:
        intent.last_payment_error?.message ??
        payment?.failure_reason ??
        'The payment was declined.',
    };
  }
  return { state: 'pending', payment };
}

/** Admin refund (full amount). The `charge.refunded` webhook is idempotent with this. */
export async function refundPayment(
  paymentId: string,
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent',
): Promise<Payment> {
  const stripe = getStripe();
  const db = createSupabaseAdminClient();
  const { data: payment, error } = await db
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load payment: ${error.message}`);
  if (!payment) throw new ApiError(404, 'Payment not found.');
  if (payment.status !== 'completed')
    throw new ApiError(
      409,
      `Only completed payments can be refunded (this one is ${payment.status}).`,
    );
  if (!payment.stripe_payment_intent_id)
    throw new ApiError(409, 'This payment has no Stripe charge to refund.');

  await stripe.refunds.create(
    {
      payment_intent: payment.stripe_payment_intent_id,
      reason,
      metadata: { payment_id: payment.id },
    },
    { idempotencyKey: `refund_${payment.id}` },
  );
  const refunded = await markRefunded(payment.id);
  if (!refunded)
    throw new Error('Refund succeeded at Stripe but the payment row could not be updated');
  return refunded;
}
