import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { RideTracker } from '@/components/ride/RideTracker';
import { requireRole } from '@/lib/auth';
import type { PaymentReturn } from '@/components/payment/PaymentPanel';
import { canAccessRide, getRideWithRelations } from '@/lib/rides/service';
import { confirmPaymentSchema, uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Your ride' };
export const dynamic = 'force-dynamic';

type TrackingSearchParams = { payment_intent?: string; checkout?: string; session_id?: string };

/**
 * Stripe sends the rider back here after a redirect-based payment (`?payment_intent=pi_…`) or after
 * Checkout (`?checkout=success&session_id=cs_…` / `?checkout=cancelled`). Ids are validated here; the
 * client then asks the server to verify them with Stripe — the URL alone never marks anything paid.
 */
function parsePaymentReturn(searchParams: TrackingSearchParams): PaymentReturn | undefined {
  if (searchParams.checkout === 'cancelled') return { checkoutCancelled: true };
  if (searchParams.payment_intent) {
    const parsed = confirmPaymentSchema.safeParse({ paymentIntentId: searchParams.payment_intent });
    if (parsed.success && 'paymentIntentId' in parsed.data) return { paymentIntentId: parsed.data.paymentIntentId };
  }
  if (searchParams.checkout === 'success' && searchParams.session_id) {
    const parsed = confirmPaymentSchema.safeParse({ sessionId: searchParams.session_id });
    if (parsed.success && 'sessionId' in parsed.data) return { sessionId: parsed.data.sessionId };
  }
  return undefined;
}

export default async function TrackingPage({ params, searchParams }: { params: { rideId: string }; searchParams: TrackingSearchParams }) {
  const user = await requireRole('rider');

  // Malformed ids, unknown rides and other riders' rides all look the same: 404.
  if (!uuidSchema.safeParse(params.rideId).success) notFound();
  const ride = await getRideWithRelations(params.rideId);
  if (!ride || !canAccessRide(user, ride) || ride.rider_id !== user.id) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/rider"
          className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Home
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Your ride</h1>
      </div>
      <RideTracker initialRide={ride} paymentReturn={parsePaymentReturn(searchParams)} />
    </div>
  );
}
