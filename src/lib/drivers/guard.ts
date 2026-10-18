import 'server-only';

import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth';
import { getDriverProfile } from '@/lib/drivers/service';
import type { DriverProfile, User } from '@/types';

/** Driver pages need a driver_profiles row; new drivers are sent to the setup form first. */
export async function requireDriverWithProfile(): Promise<{ user: User; profile: DriverProfile }> {
  const user = await requireRole('driver');
  const profile = await getDriverProfile(user.id);
  if (!profile) redirect('/driver/profile?setup=1');
  return { user, profile };
}
