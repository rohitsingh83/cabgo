'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';

import { runAdminAction, apiFetch } from '@/components/admin/actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/** Close an alert once the user has been reached and is safe. */
export function SosResolveButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setBusy(true);
    const failure = await runAdminAction(() => apiFetch(`/api/admin/sos/${alertId}`, { method: 'PATCH', body: {} }), { title: 'Alert resolved' });
    setBusy(false);
    if (failure) toast({ variant: 'destructive', title: 'Could not resolve the alert', description: failure });
    else router.refresh();
  };

  return (
    <Button variant="success" className="h-11" onClick={() => void resolve()} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />} Mark resolved
    </Button>
  );
}
