import type { Metadata } from 'next';

import { buildHref } from '@/components/admin/AdminToolbar';
import { PromoManager } from '@/components/admin/PromoManager';
import { PageHeader } from '@/components/shared/PageHeader';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { listPromos } from '@/lib/admin/promos';
import { parseSearchParams } from '@/lib/admin/search-params';
import { requireRole } from '@/lib/auth';
import { adminPromoQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Promo codes' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'inactive', label: 'Paused' },
  { value: 'expired', label: 'Finished' },
] as const;

export default async function AdminPromoPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const query = parseSearchParams(adminPromoQuerySchema, searchParams);
  const promos = await listPromos(query.status);

  return (
    <div className="space-y-6">
      <PageHeader title="Promo codes" description="Create, pause and track discount codes." className="mb-0" actions={<SegmentedLinks className="max-w-full overflow-x-auto" label="Filter" items={STATUSES.map((s) => ({ label: s.label, href: buildHref('/admin/promo', { status: s.value }, { status: 'all' }), active: query.status === s.value }))} />} />
      <PromoManager promos={promos} />
    </div>
  );
}
