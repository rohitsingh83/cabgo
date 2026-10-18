import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Mail, Phone } from 'lucide-react';

import { RoleBadge, UserStatusBadge, VerificationBadge } from '@/components/admin/AdminBadges';
import { AdminSection, BackLink, InfoList, MiniStat, RideLinkList } from '@/components/admin/AdminSection';
import { UserStatusButton } from '@/components/admin/UserStatusButton';
import { TicketStatusBadge } from '@/components/support/TicketStatusBadge';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { getUserDetail } from '@/lib/admin/users';
import { requireRole } from '@/lib/auth';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'User details' };
export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const admin = await requireRole('admin');
  if (!uuidSchema.safeParse(params.id).success) notFound();
  const detail = await getUserDetail(params.id);
  if (!detail) notFound();

  const { user, driverProfile, stats, recentRides, recentTickets } = detail;
  const protectedReason = user.id === admin.id ? 'You cannot suspend your own account.' : user.role === 'admin' ? 'Admin accounts cannot be suspended here.' : undefined;
  const isDriver = user.role === 'driver';

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/users">All users</BackLink>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar name={user.full_name} src={user.avatar_url} className="h-16 w-16 text-lg" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{user.full_name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                <UserStatusBadge active={user.is_active} />
                {driverProfile && <VerificationBadge status={driverProfile.verification_status} />}
              </div>
            </div>
          </div>
          <UserStatusButton userId={user.id} name={user.full_name} isActive={user.is_active} protectedReason={protectedReason} />
        </div>
      </div>

      <section aria-label="Activity" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Rides as rider" value={String(stats.ridesAsRider)} />
        <MiniStat label="Rides as driver" value={String(stats.ridesAsDriver)} />
        <MiniStat label="Total spent" value={formatCurrency(stats.totalSpent)} />
        <MiniStat label="Total earned" value={formatCurrency(stats.totalEarned)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <AdminSection title="Recent rides">
            <RideLinkList rides={recentRides} empty="No rides yet." />
          </AdminSection>
          <AdminSection title="Support tickets" action={<span className="text-xs text-muted-foreground">{stats.tickets} total</span>}>
            {recentTickets.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No tickets.</p>
            ) : (
              <ul className="-mx-2 space-y-1">
                {recentTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={`/admin/support/${ticket.id}`} className="flex min-h-[56px] items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(ticket.created_at)}</p>
                      </div>
                      <TicketStatusBadge status={ticket.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminSection>
        </div>

        <div className="space-y-6">
          <AdminSection title="Account">
            <InfoList
              items={[
                { label: 'Email', value: user.email ? <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{user.email}</span> : '—' },
                { label: 'Phone', value: user.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{user.phone}</span> : '—' },
                { label: 'Joined', value: formatDate(user.created_at) },
                { label: 'Onboarding', value: user.onboarding_completed ? 'Completed' : 'Not finished' },
                { label: 'SOS alerts', value: String(stats.sosAlerts) },
              ]}
            />
          </AdminSection>

          {isDriver && driverProfile && (
            <AdminSection title="Driver profile">
              <InfoList
                items={[
                  { label: 'Vehicle', value: `${driverProfile.vehicle_color} ${driverProfile.vehicle_model}` },
                  { label: 'Plate', value: driverProfile.vehicle_plate },
                  { label: 'Rating', value: `${Number(driverProfile.average_rating).toFixed(1)} (${driverProfile.rating_count})` },
                  { label: 'Online', value: driverProfile.is_online ? 'Yes' : 'No' },
                ]}
              />
              <Link href={`/admin/drivers/${user.id}`} className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                Review documents <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </AdminSection>
          )}
        </div>
      </div>
    </div>
  );
}
