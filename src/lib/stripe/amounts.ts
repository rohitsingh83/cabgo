import { CURRENCY } from '@/lib/constants';

/** Currencies Stripe treats as having no minor unit (1 unit = 1 "cent"). INR is NOT one of them. */
const ZERO_DECIMAL = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
]);

/** ₹284.50 → 28450 paise. Always rounds to an integer — Stripe rejects fractional amounts. */
export function toMinorUnits(amount: number, currency: string = CURRENCY): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? Math.round(amount) : Math.round(amount * 100);
}

export function fromMinorUnits(minor: number, currency: string = CURRENCY): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? minor : minor / 100;
}

/** Stripe's minimum charge for INR is ₹0.50; below that a PaymentIntent cannot be created. */
export const MIN_CHARGE_MINOR = 50;
