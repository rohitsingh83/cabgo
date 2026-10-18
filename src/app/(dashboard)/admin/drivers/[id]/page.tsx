import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, FileText, ImageOff } from 'lucide-react';

import { RoleBadge, UserStatusBadge, VerificationBadge } from '@/components/admin/AdminBadges';
import { AdminSection, BackLink, InfoList, MiniStat, RideLinkList } from '@/components/admin/AdminSection';
import { DriverReviewActions } from '@/components/admin/DriverReviewActions';
import { UserStatusButton } from '@/components/admin/UserStatusButton';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { getDriverDetail } from '@/lib/admin/drivers';
import { requireRole } from '@/lib/auth';
import { VEHICLES } from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Driver review' };
export const dynamic = 'force-dynamic';

const isImage = (url: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(new URL(url).pathname);

function DocumentCard({ title, url }: { title: string; url: string | null }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        {url && isImage(url) ? (
          // Signed Supabase URL (expires in 1 h) — a plain <img> avoids whitelisting a per-project image domain.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${title} document`} className="h-full w-full object-cover" loading="lazy" />
        ) : url ? (
          <FileText className="h-10 w-10 text-muted-foreground" aria-hidden />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImageOff className="h-8 w-8" aria-hidden /> Not uploaded
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <p className="text-sm font-semibold">{title}</p>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand hover:underline">
            Open <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

export default async function AdminDriverDetailPage({ params }: { params: { id: string } }) {
  const admin = await requireRole('admin');
  if (!uuidSchema.safeParse(params.id).success) notFound();
  const detail = await getDriverDetail(params.id);
  if (!detail) notFound();

  const { profile, user, documents, ratings, totalEarned, recentRides } = detail;
  const documentsComplete = Boolean(profile.license_document_url && profile.vehicle_document_url);

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/drivers">All drivers</BackLink>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar name={user.full_name} src={user.avatar_url} className="h-16 w-16 text-lg" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{user.full_name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                <VerificationBadge status={profile.verification_status} />
                <UserStatusBadge active={user.is_active} />
              </div>
            </div>
          </div>
          <UserStatusButton userId={user.id} name={user.full_name} isActive={user.is_active} protectedReason={user.id === admin.id ? 'You cannot suspend your own account.' : undefined} />
        </div>
      </div>

      <section aria-label="Performance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Completed rides" value={String(profile.total_rides)} />
        <MiniStat label="Rating" value={ratings.count > 0 ? `${Number(ratings.average).toFixed(1)} ★` : '—'} />
        <MiniStat label="Reviews" value={String(ratings.count)} />
        <MiniStat label="Total earned" value={formatCurrency(totalEarned)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <AdminSection title="Verification">
            {profile.verification_status === 'rejected' && profile.rejection_reason && (
              <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                <span className="font-semibold text-destructive">Rejected: </span>
                {profile.rejection_reason}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <DocumentCard title="Driving licence" url={documents.license} />
              <DocumentCard title="Vehicle registration" url={documents.vehicle} />
            </div>
            <div className="mt-5">
              <DriverReviewActions driverUserId={user.id} name={user.full_name} status={profile.verification_status} documentsComplete={documentsComplete} />
            </div>
          </AdminSection>

          <AdminSection title="Recent rides">
            <RideLinkList rides={recentRides} empty="No rides yet." />
          </AdminSection>
        </div>

        <div className="space-y-6">
          <AdminSection title="Vehicle">
            <InfoList
              items={[
                { label: 'Type', value: VEHICLES[profile.vehicle_type].label },
                { label: 'Model', value: `${profile.vehicle_color} ${profile.vehicle_model}${profile.vehicle_year ? ` (${profile.vehicle_year})` : ''}` },
                { label: 'Plate', value: <span className="font-mono">{profile.vehicle_plate}</span> },
                { label: 'Licence no.', value: <span className="font-mono">{profile.license_number}</span> },
              ]}
            />
          </AdminSection>
          <AdminSection title="Contact & status">
            <InfoList
              items={[
                { label: 'Email', value: user.email ?? '—' },
                { label: 'Phone', value: user.phone ?? '—' },
                { label: 'Applied', value: formatDate(profile.created_at) },
                { label: 'Verified', value: profile.verified_at ? formatDateTime(profile.verified_at) : '—' },
                { label: 'Online now', value: profile.is_online ? 'Yes' : 'No' },
              ]}
            />
            <Link href={`/admin/users/${user.id}`} className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand hover:underline">
              Full account page
            </Link>
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
