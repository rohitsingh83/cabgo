'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserX } from 'lucide-react';

import { runAdminAction, apiFetch } from '@/components/admin/actions';
import { ConfirmReasonDialog } from '@/components/admin/ConfirmReasonDialog';
import { Button } from '@/components/ui/button';

interface UserStatusButtonProps {
  userId: string;
  name: string;
  isActive: boolean;
  /** Admin accounts and your own account cannot be suspended. */
  protectedReason?: string;
}

/** Suspend / reinstate an account (with a reason for the audit log when suspending). */
export function UserStatusButton({ userId, name, isActive, protectedReason }: UserStatusButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (protectedReason) {
    return (
      <Button variant="outline" className="h-11" disabled title={protectedReason}>
        <UserX aria-hidden /> Suspend account
      </Button>
    );
  }

  return (
    <>
      <Button variant={isActive ? 'outline' : 'success'} className={isActive ? 'h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive' : 'h-11'} onClick={() => setOpen(true)}>
        {isActive ? <UserX aria-hidden /> : <ShieldCheck aria-hidden />}
        {isActive ? 'Suspend account' : 'Reinstate account'}
      </Button>
      <ConfirmReasonDialog
        open={open}
        onOpenChange={setOpen}
        tone={isActive ? 'destructive' : 'brand'}
        title={isActive ? `Suspend ${name}?` : `Reinstate ${name}?`}
        description={isActive ? 'They will be signed out of the app immediately and cannot book or drive until reinstated. Unmatched ride requests are cancelled.' : 'They will be able to sign in and use CabGo again.'}
        confirmLabel={isActive ? 'Suspend' : 'Reinstate'}
        reason={isActive ? { label: 'Reason', placeholder: 'e.g. Repeated fraudulent bookings', minLength: 0, maxLength: 200 } : undefined}
        onConfirm={async (reason) => {
          const failure = await runAdminAction(() => apiFetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: { isActive: !isActive, ...(reason ? { reason } : {}) } }), {
            title: isActive ? 'Account suspended' : 'Account reinstated',
            description: name,
          });
          if (!failure) router.refresh();
          return failure;
        }}
      />
    </>
  );
}
