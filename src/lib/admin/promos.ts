import 'server-only';

import { ApiError } from '@/lib/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { promoState } from '@/lib/admin/promo-state';
import type { PromoCode } from '@/types';

export async function listPromos(status: 'all' | 'active' | 'scheduled' | 'expired' | 'inactive'): Promise<PromoCode[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('promo_codes').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(`Failed to load promo codes: ${error.message}`);
  const rows = data ?? [];
  if (status === 'all') return rows;
  // "expired" also covers fully redeemed codes: both are finished from the admin's point of view.
  return rows.filter((promo) => {
    const state = promoState(promo);
    return status === 'expired' ? state === 'expired' || state === 'exhausted' : state === status;
  });
}

interface PromoInput {
  code: string;
  description: string | null;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  maxDiscount?: number | null;
  minFare: number;
  maxUses?: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

function duplicate(error: { code?: string } | null): ApiError | null {
  return error?.code === '23505' ? new ApiError(409, 'A promo code with this name already exists.', { code: ['Already in use'] }) : null;
}

export async function createPromo(input: PromoInput): Promise<PromoCode> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('promo_codes')
    .insert({
      code: input.code,
      description: input.description,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      max_discount: input.discountType === 'percentage' ? input.maxDiscount ?? null : null,
      min_fare: input.minFare,
      max_uses: input.maxUses ?? null,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      is_active: input.isActive,
    })
    .select('*')
    .single();
  const conflict = duplicate(error);
  if (conflict) throw conflict;
  if (error || !data) throw new Error(`Failed to create promo code: ${error?.message ?? 'no row returned'}`);
  return data;
}

type PromoPatch = Partial<PromoInput>;

/**
 * Edit a promo. The merged result is re-validated against the stored values, because a partial update
 * (e.g. only `validUntil`) can still violate a cross-field rule (percentage ≤ 100, end after start).
 */
export async function updatePromo(id: string, patch: PromoPatch): Promise<PromoCode> {
  const db = createSupabaseAdminClient();
  const { data: current, error } = await db.from('promo_codes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load promo code: ${error.message}`);
  if (!current) throw new ApiError(404, 'Promo code not found.');

  if (patch.code !== undefined && patch.code.toUpperCase() !== current.code.toUpperCase() && current.current_uses > 0) {
    throw new ApiError(409, 'This code has already been redeemed, so its name can no longer change. Create a new code instead.', { code: ['Locked after first use'] });
  }

  const discountType = patch.discountType ?? current.discount_type;
  const discountValue = patch.discountValue ?? Number(current.discount_value);
  const validFrom = patch.validFrom ?? current.valid_from;
  const validUntil = patch.validUntil ?? current.valid_until;
  const maxUses = patch.maxUses === undefined ? current.max_uses : patch.maxUses;

  if (discountType === 'percentage' && discountValue > 100) throw new ApiError(400, 'A percentage discount cannot exceed 100.', { discountValue: ['Cannot exceed 100'] });
  if (new Date(validUntil) <= new Date(validFrom)) throw new ApiError(400, 'The end date must be after the start date.', { validUntil: ['Must be after the start date'] });
  if (maxUses !== null && maxUses < current.current_uses) {
    throw new ApiError(400, `This code has already been used ${current.current_uses} times.`, { maxUses: [`Cannot be below ${current.current_uses}`] });
  }

  const { data: updated, error: updateError } = await db
    .from('promo_codes')
    .update({
      ...(patch.code !== undefined && { code: patch.code }),
      ...(patch.description !== undefined && { description: patch.description }),
      discount_type: discountType,
      discount_value: discountValue,
      max_discount: discountType === 'percentage' ? (patch.maxDiscount === undefined ? current.max_discount : patch.maxDiscount) : null,
      ...(patch.minFare !== undefined && { min_fare: patch.minFare }),
      max_uses: maxUses,
      valid_from: validFrom,
      valid_until: validUntil,
      ...(patch.isActive !== undefined && { is_active: patch.isActive }),
    })
    .eq('id', id)
    .select('*')
    .single();
  const conflict = duplicate(updateError);
  if (conflict) throw conflict;
  if (updateError || !updated) throw new Error(`Failed to update promo code: ${updateError?.message ?? 'no row returned'}`);
  return updated;
}

/** Codes that were ever redeemed are kept for the audit trail — deactivate them instead. */
export async function deletePromo(id: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const { data: promo, error } = await db.from('promo_codes').select('id, current_uses').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load promo code: ${error.message}`);
  if (!promo) throw new ApiError(404, 'Promo code not found.');
  if (promo.current_uses > 0) throw new ApiError(409, 'This code has been redeemed, so it cannot be deleted. Deactivate it instead.');
  const { error: deleteError } = await db.from('promo_codes').delete().eq('id', id);
  if (deleteError) throw new Error(`Failed to delete promo code: ${deleteError.message}`);
}
