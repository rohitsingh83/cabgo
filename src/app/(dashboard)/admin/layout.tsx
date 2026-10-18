import type { ReactNode } from 'react';

import { AdminLiveListener } from '@/components/admin/AdminLiveListener';
import { requireRole } from '@/lib/auth';

/** Only admin accounts may enter /admin; everyone else is redirected to their own dashboard. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole('admin');
  return (
    <>
      {/* Announces new SOS alerts on every admin page, not only on /admin/sos. */}
      <AdminLiveListener />
      {children}
    </>
  );
}
