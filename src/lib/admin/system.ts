import 'server-only';

import { isEmailConfigured } from '@/lib/email';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { isMapsConfigured } from '@/lib/google-maps/server';
import { isSmsConfigured } from '@/lib/sms';
import { isStripeConfigured, isWebhookConfigured } from '@/lib/stripe/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type CheckState = 'ok' | 'warn' | 'off';

export interface SystemCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  /** Environment variables that control this integration (names only — values are never exposed). */
  env: string[];
}

/** A key that is present and not the `.env.example` placeholder. */
const real = (value: string | undefined): boolean => Boolean(value) && !/x{6,}|REPLACE_ME|your-|example/i.test(value as string);

/** Cheap, read-only liveness probes — never throws and never leaks secrets. */
async function probeRealtime(): Promise<SystemCheck> {
  const base: Omit<SystemCheck, 'state' | 'detail'> = { id: 'realtime', label: 'Realtime server (Socket.IO)', env: ['REALTIME_SERVER_URL', 'REALTIME_INTERNAL_SECRET', 'NEXT_PUBLIC_SOCKET_URL'] };
  const url = process.env.REALTIME_SERVER_URL;
  if (!url || !process.env.REALTIME_INTERNAL_SECRET) return { ...base, state: 'off', detail: 'Not configured — clients fall back to polling.' };
  try {
    const started = Date.now();
    const response = await fetch(`${url.replace(/\/$/, '')}/health`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    if (!response.ok) return { ...base, state: 'warn', detail: `Health check answered HTTP ${response.status}.` };
    return { ...base, state: 'ok', detail: `Healthy · ${Date.now() - started} ms` };
  } catch {
    return { ...base, state: 'warn', detail: 'Configured but unreachable — clients are polling.' };
  }
}

async function probeDatabase(): Promise<SystemCheck> {
  const base: Omit<SystemCheck, 'state' | 'detail'> = { id: 'database', label: 'Supabase Postgres', env: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] };
  if (!real(process.env.NEXT_PUBLIC_SUPABASE_URL) || !real(process.env.SUPABASE_SERVICE_ROLE_KEY)) return { ...base, state: 'off', detail: 'Not configured.' };
  try {
    const started = Date.now();
    const { error } = await createSupabaseAdminClient().from('users').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) return { ...base, state: 'warn', detail: `Query failed: ${error.message}` };
    return { ...base, state: 'ok', detail: `Reachable · ${Date.now() - started} ms` };
  } catch {
    return { ...base, state: 'warn', detail: 'Configured but the request failed.' };
  }
}

export async function getSystemChecks(): Promise<SystemCheck[]> {
  const [database, realtime] = await Promise.all([probeDatabase(), probeRealtime()]);
  const stripeReady = isStripeConfigured();

  return [
    database,
    { id: 'clerk', label: 'Clerk authentication', env: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET'], ...(real(process.env.CLERK_SECRET_KEY) && real(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ? (real(process.env.CLERK_WEBHOOK_SECRET) ? { state: 'ok' as const, detail: 'Keys and webhook secret present.' } : { state: 'warn' as const, detail: 'Webhook secret missing — user changes in Clerk will not sync.' }) : { state: 'off' as const, detail: 'Not configured.' }) },
    { id: 'stripe', label: 'Stripe payments', env: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'], ...(stripeReady ? (isWebhookConfigured() ? { state: 'ok' as const, detail: 'API key and webhook secret present.' } : { state: 'warn' as const, detail: 'Webhook secret missing — payments will not auto-confirm.' }) : { state: 'off' as const, detail: 'Not configured — riders cannot pay.' }) },
    { id: 'maps', label: 'Google Maps Platform', env: ['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY'], ...(isMapsConfigured() ? { state: 'ok' as const, detail: 'Server key present.' } : { state: 'off' as const, detail: 'Not configured — demo places and straight-line routes are used.' }) },
    realtime,
    { id: 'firebase', label: 'Firebase Realtime Database', env: ['NEXT_PUBLIC_FIREBASE_DATABASE_URL', 'FIREBASE_ADMIN_PROJECT_ID'], ...(isFirebaseConfigured() ? { state: 'ok' as const, detail: 'Client config present (live-location fallback).' } : { state: 'off' as const, detail: 'Not configured — tracking relies on Socket.IO only.' }) },
    { id: 'email', label: 'Email (receipts)', env: ['RESEND_API_KEY', 'SMTP_HOST', 'EMAIL_FROM'], ...(isEmailConfigured() ? { state: 'ok' as const, detail: 'A provider is configured.' } : { state: 'off' as const, detail: 'Not configured — receipt emails are skipped.' }) },
    { id: 'sms', label: 'SMS (SOS alerts)', env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'], ...(isSmsConfigured() ? { state: 'ok' as const, detail: 'Twilio configured.' } : { state: 'warn' as const, detail: 'Not configured — SOS falls back to manual sharing by the user.' }) },
  ];
}
