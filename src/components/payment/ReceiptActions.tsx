'use client';

import { Download, Printer } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Print (browser "Save as PDF") and download-as-HTML buttons for a receipt. */
export function ReceiptActions({ paymentId }: { paymentId: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row print:hidden">
      <Button variant="outline" className="h-12 flex-1" onClick={() => window.print()}>
        <Printer aria-hidden /> Print / save as PDF
      </Button>
      <a
        href={`/api/payments/${paymentId}/receipt?download=1`}
        className={cn(buttonVariants({ variant: 'outline' }), 'h-12 flex-1')}
      >
        <Download aria-hidden /> Download receipt
      </a>
    </div>
  );
}
