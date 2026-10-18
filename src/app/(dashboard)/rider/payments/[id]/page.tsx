import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Car, Wallet } from 'lucide-react';

import { ReceiptActions } from '@/components/payment/ReceiptActions';
import { ReceiptView } from '@/components/payment/ReceiptView';
import { Reveal } from '@/components/shared/Reveal';
import { buttonVariants } from '@/components/ui/button';
import { requireRole } from '@/lib/auth';
import { getReceiptData } from '@/lib/payments/receipt';
import { cn } from '@/lib/utils';
import { uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Receipt' };
export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const user = await requireRole('rider');

  // Malformed ids, unknown payments and other riders' payments are all a 404.
  if (!uuidSchema.safeParse(params.id).success) notFound();
  const data = await getReceiptData(params.id);
  if (!data || data.payment.rider_id !== user.id) notFound();

  const { receipt, payment } = data;
  const unpaid = payment.status === 'pending' || payment.status === 'failed';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/rider/payments"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All payments
      </Link>

      <Reveal>
        <ReceiptView receipt={receipt} />
      </Reveal>

      {unpaid ? (
        <Link
          href={`/rider/tracking/${payment.ride_id}`}
          className={cn(
            buttonVariants({ variant: 'brand', size: 'xl' }),
            'h-14 w-full print:hidden',
          )}
        >
          <Wallet aria-hidden /> Complete payment
        </Link>
      ) : (
        <ReceiptActions paymentId={payment.id} />
      )}

      <Link
        href={`/rider/tracking/${payment.ride_id}`}
        className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 w-full print:hidden')}
      >
        <Car aria-hidden /> View ride details
      </Link>
    </div>
  );
}
