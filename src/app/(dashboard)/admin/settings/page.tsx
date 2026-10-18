import type { Metadata } from 'next';
import { CheckCircle2, CircleDashed, TriangleAlert } from 'lucide-react';

import { AdminSection, InfoList } from '@/components/admin/AdminSection';
import { PageHeader } from '@/components/shared/PageHeader';
import { getSystemChecks, type CheckState } from '@/lib/admin/system';
import { requireRole } from '@/lib/auth';
import { BUSINESS_RULES, SURGE_MAX } from '@/lib/constants';
import { BUSINESS_TIMEZONE } from '@/lib/drivers/service';
import { cn, formatCurrency } from '@/lib/utils';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

const STATE = {
  ok: { label: 'Operational', icon: CheckCircle2, tone: 'text-success bg-success/10' },
  warn: { label: 'Needs attention', icon: TriangleAlert, tone: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  off: { label: 'Not configured', icon: CircleDashed, tone: 'text-muted-foreground bg-muted' },
} satisfies Record<CheckState, { label: string; icon: typeof CheckCircle2; tone: string }>;

export default async function AdminSettingsPage() {
  await requireRole('admin');
  const checks = await getSystemChecks();
  const problems = checks.filter((check) => check.state === 'warn').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Platform rules and the health of every connected service. Secrets are never shown here." className="mb-0" />

      <section aria-label="Integrations" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold">Integrations</h2>
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', problems > 0 ? STATE.warn.tone : STATE.ok.tone)}>{problems > 0 ? `${problems} need${problems === 1 ? 's' : ''} attention` : 'No problems detected'}</span>
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => {
            const { icon: Icon, tone, label } = STATE[check.state];
            return (
              <li key={check.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{check.label}</p>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tone)}>
                    <Icon className="h-3 w-3" aria-hidden /> {label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{check.detail}</p>
                <p className="mt-3 break-words font-mono text-[11px] leading-relaxed text-muted-foreground/80">{check.env.join(' · ')}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection title="Business rules">
          <InfoList
            items={[
              { label: 'Driver matching radius', value: `${BUSINESS_RULES.matchingRadiusKm} km (expands to ${BUSINESS_RULES.matchingExpandedRadiusKm} km)` },
              { label: 'Driver response window', value: `${BUSINESS_RULES.matchingTimeoutSeconds} seconds` },
              { label: 'Free cancellation window', value: `${BUSINESS_RULES.freeCancellationSeconds / 60} minutes` },
              { label: 'Late cancellation fee', value: formatCurrency(BUSINESS_RULES.cancellationFee) },
              { label: 'Platform commission', value: `${BUSINESS_RULES.platformCommissionPercent}%` },
              { label: 'Maximum surge', value: `${SURGE_MAX}×` },
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">Read from environment variables (see <span className="font-mono">src/lib/constants.ts</span>) and enforced by the server — change them in your hosting dashboard and redeploy.</p>
        </AdminSection>

        <AdminSection title="Environment">
          <InfoList
            items={[
              { label: 'Mode', value: process.env.NODE_ENV },
              { label: 'Business timezone', value: BUSINESS_TIMEZONE },
              { label: 'App URL', value: process.env.NEXT_PUBLIC_APP_URL ?? 'Not set' },
              { label: 'Server time', value: new Date().toLocaleString('en-IN', { timeZone: BUSINESS_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }) },
            ]}
          />
        </AdminSection>
      </div>
    </div>
  );
}
