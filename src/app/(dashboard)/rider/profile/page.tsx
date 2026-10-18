import type { Metadata } from 'next';

import { ProfileForm } from '@/components/profile/ProfileForm';
import { SavedPlacesManager } from '@/components/profile/SavedPlacesManager';
import { EmergencyContactsManager } from '@/components/safety/EmergencyContactsManager';
import { PageHeader } from '@/components/shared/PageHeader';
import { requireRole } from '@/lib/auth';
import { getSavedPlacesForUser } from '@/lib/rides/queries';
import { listEmergencyContacts } from '@/lib/safety/sos';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function RiderProfilePage() {
  const user = await requireRole('rider');
  const [savedPlaces, contacts] = await Promise.all([getSavedPlacesForUser(user.id), listEmergencyContacts(user.id)]);

  return (
    <div>
      <PageHeader title="Profile" description="Your details and the places you go most." />
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <ProfileForm user={user} />
        <section id="saved-places" className="scroll-mt-24" aria-labelledby="saved-places-title">
          <h2 id="saved-places-title" className="sr-only">
            Saved places
          </h2>
          <div className="mb-4">
            <p className="font-display text-lg font-extrabold">Saved places</p>
            <p className="text-sm text-muted-foreground">Book Home or Work in one tap.</p>
          </div>
          <SavedPlacesManager initialPlaces={savedPlaces} />

          <div id="emergency-contacts" className="mt-10 scroll-mt-24">
            <div className="mb-4">
              <p className="font-display text-lg font-extrabold">Emergency contacts</p>
              <p className="text-sm text-muted-foreground">Texted with your live location when you press SOS.</p>
            </div>
            <EmergencyContactsManager initialContacts={contacts} />
          </div>
        </section>
      </div>
    </div>
  );
}
