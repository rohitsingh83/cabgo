import { NextResponse } from 'next/server';

import { ApiError, parseParam, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { renderReceiptHtml } from '@/lib/email/receipt';
import { getReceiptData } from '@/lib/payments/receipt';
import { uuidSchema } from '@/lib/validations';
import { absoluteUrl } from '@/lib/utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ download: z.enum(['1', '0']).default('0') });

/**
 * GET /api/payments/[id]/receipt[?download=1] — the receipt as a standalone HTML document.
 * Only the rider who paid (or an admin) can read it; everyone else gets a 404.
 */
export const GET = withApi<{ id: string }>(async (request, { params }) => {
  const user = await requireApiUser(['rider', 'admin']);
  const id = parseParam(uuidSchema, params.id, 'payment id');
  const { download } = parseQuery(request, querySchema);

  const data = await getReceiptData(id);
  if (!data || (user.role !== 'admin' && data.payment.rider_id !== user.id))
    throw new ApiError(404, 'Receipt not found.');

  const html = renderReceiptHtml(data.receipt, { appUrl: absoluteUrl(`/rider/payments/${id}`) });
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Receipts contain addresses — never cache them in shared caches.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(download === '1'
        ? { 'Content-Disposition': `attachment; filename="${data.receipt.number}.html"` }
        : {}),
    },
  });
});
