import type { ReactNode } from 'react';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { requireRole } from '@/lib/auth';
import { USER_ROLES } from '@/lib/roles';

/**
 * Shared frame for /rider, /driver and /admin.
 * `requireRole` verifies: signed in → active → onboarded. The role-specific nested layouts
 * then narrow access to the matching section (defence in depth on top of the middleware).
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(USER_ROLES);

  return (
    <DashboardShell
      user={{
        name: user.full_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        role: user.role,
      }}
    >
      {children}
    </DashboardShell>
  );
}
