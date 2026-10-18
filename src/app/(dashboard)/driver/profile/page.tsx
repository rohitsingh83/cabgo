import type { Metadata } from 'next';

import { DriverProfileForm } from '@/components/driver/DriverProfileForm';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { EmergencyContactsManager } from '@/components/safety/EmergencyContactsManager';
import { PageHeader } from '@/components/shared/PageHeader';
import { requireRole } from '@/lib/auth';
import { STORAGE_BUCKETS } from '@/lib/constants';
import { getDriverProfile } from '@/lib/drivers/service';
import { listEmergencyContacts } from '@/lib/safety/sos';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Driver profile' };
export const dynamic = 'force-dynamic';

/** Private documents are shown via 1-hour signed links. */
async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const db = createSupabaseAdminClient();
  const { data, error } = await db.storage.from(STORAGE_BUCKETS.driverDocuments).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export default async function DriverProfilePage({ searchParams }: { searchParams: { setup?: string } }) {
  const user = await requireRole('driver');
  const profile = await getDriverProfile(user.id);

  const [license, vehicle, contacts] = await Promise.all([
    signedUrl(profile?.license_document_url ?? null),
    signedUrl(profile?.vehicle_document_url ?? null),
    listEmergencyContacts(user.id),
  ]);
  const isSetup = !profile;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isSetup ? 'Set up your driver profile' : 'Driver profile'}
        description={
          isSetup || searchParams.setup
            ? 'Add your vehicle and documents. We verify every driver before they can go online.'
            : 'Your personal details, vehicle and verification documents.'
        }
      />
      <div className="space-y-8">
        <DriverProfileForm profile={profile} documentUrls={{ license, vehicle }} />
        {!isSetup && (
          <section aria-labelledby="personal-heading" className="space-y-4">
            <h2 id="personal-heading" className="font-display text-lg font-extrabold">
              Personal details
            </h2>
            <ProfileForm user={user} />
          </section>
        )}
        <section id="emergency-contacts" aria-labelledby="emergency-heading" className="scroll-mt-24 space-y-4">
          <div>
            <h2 id="emergency-heading" className="font-display text-lg font-extrabold">
              Emergency contacts
            </h2>
            <p className="text-sm text-muted-foreground">Texted with your live location when you press SOS during a trip.</p>
          </div>
          <EmergencyContactsManager initialContacts={contacts} />
        </section>
      </div>
    </div>
  );
}
