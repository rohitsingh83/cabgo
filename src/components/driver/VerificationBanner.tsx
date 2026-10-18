import Link from 'next/link';
import { BadgeCheck, Clock, ShieldX } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { DriverProfile } from '@/types';

/** Shows the verification state until the driver is approved (renders nothing afterwards). */
export function VerificationBanner({ profile }: { profile: Pick<DriverProfile, 'verification_status' | 'rejection_reason' | 'license_document_url' | 'vehicle_document_url'> }) {
  if (profile.verification_status === 'approved') return null;

  const rejected = profile.verification_status === 'rejected';
  const missingDocs = !profile.license_document_url || !profile.vehicle_document_url;
  const Icon = rejected ? ShieldX : Clock;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        rejected ? 'border-destructive/30 bg-destructive/10' : 'border-amber-500/30 bg-amber-500/10',
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', rejected ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-display text-base font-extrabold">{rejected ? 'Verification rejected' : 'Verification in progress'}</p>
          <p className="text-sm text-muted-foreground">
            {rejected
              ? profile.rejection_reason ?? 'Your documents could not be verified. Update them and resubmit.'
              : missingDocs
                ? 'Upload your licence and vehicle documents so we can approve you faster.'
                : 'Our team is reviewing your documents — this usually takes less than 24 hours.'}
          </p>
        </div>
      </div>
      {(rejected || missingDocs) && (
        <Link
          href="/driver/profile"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90"
        >
          <BadgeCheck className="h-4 w-4" aria-hidden /> {rejected ? 'Update documents' : 'Upload documents'}
        </Link>
      )}
    </div>
  );
}
