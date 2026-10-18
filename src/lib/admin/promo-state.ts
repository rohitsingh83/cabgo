import type { PromoCode } from '@/types';

export type PromoState = 'active' | 'scheduled' | 'expired' | 'inactive' | 'exhausted';

/**
 * What a promo is doing right now — derived, never stored (so it can't go stale).
 * Pure and dependency-free so both server pages and client components can import it.
 */
export function promoState(promo: Pick<PromoCode, 'is_active' | 'valid_from' | 'valid_until' | 'max_uses' | 'current_uses'>, now = Date.now()): PromoState {
  if (!promo.is_active) return 'inactive';
  if (now < new Date(promo.valid_from).getTime()) return 'scheduled';
  if (now > new Date(promo.valid_until).getTime()) return 'expired';
  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) return 'exhausted';
  return 'active';
}
