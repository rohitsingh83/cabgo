import { ApiError, ok, requireApiUser, withApi } from '@/lib/api';
import { getDriverFeed, getDriverProfile } from '@/lib/drivers/service';
import type { DriverFeed } from '@/types';

export const dynamic = 'force-dynamic';

/** GET /api/driver/feed — fresh profile, current trip and open requests (polled by the dashboard). */
export const GET = withApi(async () => {
  const user = await requireApiUser(['driver']);
  const profile = await getDriverProfile(user.id);
  if (!profile) throw new ApiError(404, 'Complete your driver setup first.');

  const feed: DriverFeed = await getDriverFeed(user.id, profile);
  return ok(feed);
}, 'GET /api/driver/feed');
