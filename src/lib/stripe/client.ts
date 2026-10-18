import { loadStripe, type Stripe } from '@stripe/stripe-js';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

/**
 * True only for a real-looking key. The `.env.example` placeholder (`pk_test_xxxx…`) must not
 * count as configured, or the Payment Element would load and fail with a confusing error.
 */
export function isStripeClientConfigured(): boolean {
  return (
    /^pk_(test|live)_[A-Za-z0-9]{16,}$/.test(PUBLISHABLE_KEY) && !/x{8,}/i.test(PUBLISHABLE_KEY)
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

/** Load Stripe.js once per page (it must not be re-created on every render). */
export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}
