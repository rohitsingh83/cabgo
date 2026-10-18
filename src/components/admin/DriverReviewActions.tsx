'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Loader2, XCircle } from 'lucide-react';

import { runAdminAction, apiFetch } from '@/components/admin/actions';
import { ConfirmReasonDialog } from '@/components/admin/ConfirmReasonDialog';
import { Button } from '@/components/ui/button';
import type { VerificationStatus } from '@/types';

interface DriverReviewActionsProps {
  driverUserId: string;
  name: string;
  status: VerificationStatus;
  /** Both the licence and vehicle documents are uploaded. */
  documentsComplete: boolean;
}

/** Approve (one click) or reject (with a reason the driver will read) a driver application. */
export function DriverReviewActions({ driverUserId, name, status, documentsComplete }: DriverReviewActionsProps) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setApproving(true);
    setError(null);
    const failure = await runAdminAction(() => apiFetch(`/api/admin/drivers/${driverUserId}`, { method: 'PATCH', body: { action: 'approve' } }), {
      title: 'Driver approved',
      description: `${name} can now go online.`,
    });
    setApproving(false);
    if (failure) setError(failure);
    else router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {status !== 'approved' && (
          <Button variant="success" size="lg" className="h-12 flex-1" onClick={() => void approve()} disabled={approving || !documentsComplete}>
            {approving ? <Loader2 className="animate-spin" aria-hidden /> : <BadgeCheck aria-hidden />} Approve driver
          </Button>
        )}
        {status !== 'rejected' && (
          <Button variant="outline" size="lg" className="h-12 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRejecting(true)} disabled={approving}>
            <XCircle aria-hidden /> {status === 'approved' ? 'Revoke verification' : 'Reject'}
          </Button>
        )}
      </div>
      {!documentsComplete && status !== 'approved' && <p className="text-xs text-muted-foreground">Approval is available once both documents are uploaded.</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={status === 'approved' ? `Revoke ${name}'s verification?` : `Reject ${name}'s application?`}
        description="The driver is notified with your message, so say exactly what to fix. They are taken offline straight away."
        confirmLabel={status === 'approved' ? 'Revoke' : 'Reject'}
        reason={{ label: 'Message to the driver', placeholder: 'e.g. The licence photo is blurry — please upload a clearer copy.', minLength: 5, maxLength: 300 }}
        onConfirm={async (reason) => {
          const failure = await runAdminAction(() => apiFetch(`/api/admin/drivers/${driverUserId}`, { method: 'PATCH', body: { action: 'reject', reason } }), {
            title: status === 'approved' ? 'Verification revoked' : 'Application rejected',
            description: name,
          });
          if (!failure) router.refresh();
          return failure;
        }}
      />
    </div>
  );
}
