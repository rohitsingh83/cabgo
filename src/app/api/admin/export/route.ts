import { NextResponse } from 'next/server';

import { parseQuery, requireApiUser, withApi } from '@/lib/api';
import { buildExport } from '@/lib/admin/export';
import { adminExportQuerySchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/** GET /api/admin/export?type=rides|payments|users&range=30d&status=… — CSV download (max 5 000 rows). */
export const GET = withApi(async (request) => {
  await requireApiUser(['admin']);
  const { type, range, status } = parseQuery(request, adminExportQuerySchema);
  const { filename, csv } = await buildExport(type, range, status);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}, 'GET /api/admin/export');
