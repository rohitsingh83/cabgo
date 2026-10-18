import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

import {
  failPayment,
  markRefunded,
  settleCheckoutSession,
  settlePaymentIntent,
} from '@/lib/payments/settle';
import {
  getStripe,
  getWebhookSecret,
  isStripeConfigured,
  isWebhookConfigured,
} from '@/lib/stripe/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Signature verification needs the exact raw bytes, and Stripe's SDK needs Node crypto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 *
 *  - 400 → bad/missing signature (Stripe will not retry usefully)
 *  - 500 → our handler failed; Stripe retries with backoff for up to 3 days
 *  - 200 → processed or deliberately ignored
 *
 * Every handler is idempotent (see lib/payments/settle.ts), so retries and duplicate deliveries are safe.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isStripeConfigured() || !isWebhookConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Stripe webhooks are not configured.' },
      { status: 503 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature)
    return NextResponse.json(
      { success: false, error: 'Missing stripe-signature header.' },
      { status: 400 },
    );

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, getWebhookSecret());
  } catch (error) {
    console.warn(
      '[stripe-webhook] signature verification failed:',
      error instanceof Error ? error.message.split('\n')[0] : error,
    );
    return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    await handleEvent(event);
    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error(`[stripe-webhook] handler failed for ${event.type} (${event.id}):`, error);
    return NextResponse.json({ success: false, error: 'Webhook handler failed.' }, { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      await settlePaymentIntent(event.data.object.id);
      return;
    }

    case 'payment_intent.payment_failed': {
      await failPayment(event.data.object);
      return;
    }

    case 'payment_intent.canceled': {
      await failPayment(event.data.object, 'The payment was cancelled.');
      return;
    }

    // Checkout: instant methods fire `completed` with payment_status "paid";
    // delayed methods (bank debits) report later via the async_* events.
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (event.data.object.payment_status === 'paid')
        await settleCheckoutSession(event.data.object.id);
      return;
    }

    case 'checkout.session.async_payment_failed': {
      const intentId =
        typeof event.data.object.payment_intent === 'string'
          ? event.data.object.payment_intent
          : event.data.object.payment_intent?.id;
      if (intentId) {
        const intent = await getStripe().paymentIntents.retrieve(intentId);
        await failPayment(intent);
      }
      return;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      // Partial refunds are left alone; only a fully refunded charge flips the payment.
      if (!charge.refunded) return;
      const intentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!intentId) return;

      const db = createSupabaseAdminClient();
      const { data: payment, error } = await db
        .from('payments')
        .select('id')
        .eq('stripe_payment_intent_id', intentId)
        .maybeSingle();
      if (error) throw new Error(`Failed to look up refunded payment: ${error.message}`);
      if (payment) await markRefunded(payment.id);
      return;
    }

    default:
      // Subscribed-to-everything endpoints get plenty of events we do not care about.
      return;
  }
}
