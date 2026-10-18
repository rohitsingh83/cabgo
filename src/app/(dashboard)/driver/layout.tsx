import type { ReactNode } from 'react';

import { requireRole } from '@/lib/auth';

/** Only driver accounts may enter /driver; everyone else is redirected to their own dashboard. */
export default async function DriverLayout({ children }: { children: ReactNode }) {
  await requireRole('driver');
  return <>{children}</>;
}
