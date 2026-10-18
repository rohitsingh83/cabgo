import type { Metadata } from 'next';

import { DriverConsole } from '@/components/driver/DriverConsole';
import { DriverStatTiles } from '@/components/driver/DriverStatTiles';
import { Reveal } from '@/components/shared/Reveal';
import { requireDriverWithProfile } from '@/lib/drivers/guard';
import { getDriverFeed, getDriverTodayStats } from '@/lib/drivers/service';

export const metadata: Metadata = { title: 'Driver dashboard' };
export const dynamic = 'force-dynamic';

export default async function DriverHomePage() {
  const { user, profile } = await requireDriverWithProfile();
  const [feed, stats] = await Promise.all([getDriverFeed(user.id, profile), getDriverTodayStats(user.id)]);
  const firstName = user.full_name.split(' ')[0] ?? user.full_name;

  return (
    <div className="space-y-6">
      <Reveal>
        <p className="text-sm font-medium text-muted-foreground">Ready to drive,</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{firstName} 🚗</h1>
      </Reveal>

      <DriverStatTiles stats={stats} profile={feed.profile} />
      <DriverConsole initialFeed={feed} />
    </div>
  );
}
