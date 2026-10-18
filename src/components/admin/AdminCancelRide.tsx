'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';

import { runAdminAction, apiFetch } from '@/components/admin/actions';
import { ConfirmReasonDialog } from '@/components/admin/ConfirmReasonDialog';
import { Button } from '@/components/ui/button';

/** Support-initiated cancellation of a live ride; the reason is shown to rider and driver. */
export function AdminCancelRide({ rideId }: { rideId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" className="h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setOpen(true)}>
        <Ban aria-hidden /> Cancel this ride
      </Button>
      <ConfirmReasonDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this ride?"
        description="Both the rider and the driver are notified straight away. The rider is not charged a cancellation fee."
        confirmLabel="Cancel ride"
        reason={{ label: 'Reason (shown to rider and driver)', placeholder: 'e.g. Driver unreachable for 10 minutes', minLength: 3, maxLength: 200 }}
        onConfirm={async (reason) => {
          const failure = await runAdminAction(() => apiFetch(`/api/admin/rides/${rideId}/cancel`, { method: 'POST', body: { reason } }), { title: 'Ride cancelled' });
          if (!failure) router.refresh();
          return failure;
        }}
      />
    </>
  );
}
