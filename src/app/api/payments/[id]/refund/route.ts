import { ok, parseOptionalBody, parseParam, requireApiUser, withApi } from '@/lib/api';
import { refundPayment } from '@/lib/payments/stripe-flow';
import { refundPaymentSchema, uuidSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

/** POST /api/payments/[id]/refund  { reason? } — admin-only full refund of a completed payment. */
export const POST = withApi<{ id: string }>(async (request, { params }) => {
  await requireApiUser(['admin']);
  const id = parseParam(uuidSchema, params.id, 'payment id');
  const { reason } = await parseOptionalBody(request, refundPaymentSchema);
  return ok(await refundPayment(id, reason));
}, 'POST /api/payments/[id]/refund', { rateLimit: RATE_LIMITS.payments });
