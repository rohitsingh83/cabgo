import { ok, parseBody, requireApiUser, withApi } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { promoValidateSchema } from '@/lib/validations';
import { RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/promo/validate  { code, fare }
 * Checks a promo code against a fare without redeeming it (redemption happens atomically
 * in the database when the ride is created).
 */
export const POST = withApi(async (request) => {
  await requireApiUser(['rider']);
  const { code, fare } = await parseBody(request, promoValidateSchema);

  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc('validate_promo_code', { p_code: code, p_fare: fare });
  if (error) throw new Error(`validate_promo_code failed: ${error.message}`);

  const row = data?.[0];
  return ok({
    valid: row?.valid ?? false,
    message: row?.message ?? 'Invalid promo code',
    discountAmount: row?.valid ? Number(row.discount_amount) : 0,
    discountType: row?.discount_type ?? null,
    discountValue: row?.discount_value ?? null,
  });
}, 'POST /api/promo/validate', { rateLimit: RATE_LIMITS.promo });
