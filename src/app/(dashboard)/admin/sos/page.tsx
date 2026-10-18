import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, MapPin, Phone, ShieldAlert, ShieldCheck } from 'lucide-react';

import { RoleBadge, SosStatusBadge } from '@/components/admin/AdminBadges';
import { buildHref } from '@/components/admin/AdminToolbar';
import { PersonCell } from '@/components/admin/PersonCell';
import { SosResolveButton } from '@/components/admin/SosResolveButton';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { parseSearchParams } from '@/lib/admin/search-params';
import { listSosAlerts, type AdminSosRow } from '@/lib/admin/sos';
import type { UserBrief } from '@/lib/admin/common';
import { requireRole } from '@/lib/auth';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import { adminSosQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'SOS alerts' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
] as const;

/** Phone numbers are stored as typed by the user; keep only what `tel:` needs. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

function CallLink({ person, label }: { person: UserBrief | null; label: string }) {
  if (!person) return null;
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <PersonCell user={person} showContact={false} />
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{person.phone ?? 'No phone on file'}</p>
        </div>
        {person.phone && (
          <a href={telHref(person.phone)} aria-label={`Call ${person.full_name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-white hover:bg-success/90">
            <Phone className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: AdminSosRow }) {
  const active = alert.status === 'active';
  const mapsUrl = `https://www.google.com/maps?q=${alert.lat},${alert.lng}`;
  return (
    <li className={cn('rounded-2xl border bg-card p-5', active ? 'border-2 border-destructive/60' : 'border-border')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-full', active ? 'bg-destructive text-white' : 'bg-success/10 text-success')}>{active ? <ShieldAlert className="h-5 w-5" aria-hidden /> : <ShieldCheck className="h-5 w-5" aria-hidden />}</span>
          <div>
            <p className="font-display text-lg font-extrabold">{alert.user?.full_name ?? 'Unknown user'}</p>
            <p className="text-xs text-muted-foreground" title={formatDateTime(alert.created_at)}>
              Raised {timeAgo(alert.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alert.user && <RoleBadge role={alert.user.role} />}
          <SosStatusBadge status={alert.status} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CallLink person={alert.user} label="Person in distress" />
        <CallLink person={alert.counterpart} label={alert.user?.role === 'driver' ? 'Rider on the trip' : 'Driver on the trip'} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-brand/50">
          <MapPin className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Last known location</span>
            <span className="block font-mono text-xs text-muted-foreground">
              {Number(alert.lat).toFixed(5)}, {Number(alert.lng).toFixed(5)}
            </span>
          </span>
          <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden />
        </a>
        {alert.ride && (
          <Link href={`/admin/rides/${alert.ride.id}`} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-brand/50">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {alert.ride.pickup_address} → {alert.ride.dropoff_address}
              </span>
              <span className="mt-1 block">
                <RideStatusBadge status={alert.ride.status} />
              </span>
            </span>
            <span className="text-sm font-semibold text-brand">Ride</span>
          </Link>
        )}
      </div>

      {alert.notified_contacts.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emergency contacts alerted by SMS</p>
          <ul className="flex flex-wrap gap-2">
            {alert.notified_contacts.map((contact) => (
              <li key={`${contact.phone}`} className={cn('rounded-full px-3 py-1 text-xs font-semibold', contact.sent ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
                {contact.name} · {contact.sent ? 'sent' : 'not delivered'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {active ? (
          <>
            <p className="text-sm text-muted-foreground">Reach the person, confirm they are safe, then close the alert.</p>
            <SosResolveButton alertId={alert.id} />
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Resolved {alert.resolved_at ? formatDateTime(alert.resolved_at) : ''}
            {alert.resolver ? ` by ${alert.resolver.full_name}` : ''}
          </p>
        )}
      </div>
    </li>
  );
}

export default async function AdminSosPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const query = parseSearchParams(adminSosQuerySchema, searchParams);
  const result = await listSosAlerts(query);
  const href = (patch: Partial<typeof query>) => buildHref('/admin/sos', { ...query, ...patch, page: patch.page ?? 1 }, { status: 'active' });

  return (
    <div className="space-y-6">
      <PageHeader title="SOS alerts" description="Safety alerts raised from live trips. This page updates the moment a new one arrives." className="mb-0" actions={<SegmentedLinks label="Status" items={STATUSES.map((s) => ({ label: s.label, href: href({ status: s.value }), active: query.status === s.value }))} />} />

      {result.items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={query.status === 'active' ? 'No active alerts' : 'No alerts found'} description={query.status === 'active' ? 'Everyone on the road is safe right now.' : 'Nothing matches this filter.'} />
      ) : (
        <>
          <ul className="space-y-4">
            {result.items.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </ul>
          <Pager page={result.page} totalPages={result.totalPages} hrefFor={(page) => href({ page })} newerLabel="Newer" olderLabel="Older" />
        </>
      )}
    </div>
  );
}
