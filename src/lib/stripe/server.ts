import 'server-only';

import Stripe from 'stripe';

import { ApiError } from '@/lib/api';

const looksReal = (value: string | undefined, pattern: RegExp): value is string =>
  Boolean(value) && pattern.test(value as string) && !/x{8,}/i.test(value as string);

/** Secret (`sk_`) or restricted (`rk_`) key that is not the .env.example placeholder. */
export function isStripeConfigured(): boolean {
  return looksReal(process.env.STRIPE_SECRET_KEY, /^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/);
}

export function isWebhookConfigured(): boolean {
  return looksReal(process.env.STRIPE_WEBHOOK_SECRET, /^whsec_[A-Za-z0-9+/=_-]{8,}$/);
}

let client: Stripe | null = null;

/**
 * Lazily created Stripe client. Throws a 503 `ApiError` when keys are missing so API routes answer
 * "payments are not configured" instead of crashing with a stack trace.
 */
export function getStripe(): Stripe {
  if (!isStripeConfigured())
    throw new ApiError(503, 'Payments are not configured yet. Please try again later.');
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      // Pinned so a Stripe-side default change can never alter our payload shapes.
      apiVersion: '2024-06-20',
      maxNetworkRetries: 2,
      timeout: 15_000,
      appInfo: { name: 'CabGo', version: '1.0.0' },
    });
  }
  return client;
}

export function getWebhookSecret(): string {
  if (!isWebhookConfigured()) throw new ApiError(503, 'Stripe webhook secret is not configured.');
  return process.env.STRIPE_WEBHOOK_SECRET as string;
}
