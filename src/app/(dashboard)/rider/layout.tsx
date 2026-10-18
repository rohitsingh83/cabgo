import type { ReactNode } from 'react';

import { requireRole } from '@/lib/auth';

/** Only rider accounts may enter /rider; everyone else is redirected to their own dashboard. */
export default async function RiderLayout({ children }: { children: ReactNode }) {
  await requireRole('rider');
  return <>{children}</>;
}
