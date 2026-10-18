import 'server-only';

import { rangeStart } from '@/lib/admin/common';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const MAX_ROWS = 5000;

/**
 * CSV cell escaping, plus protection against spreadsheet formula injection: a value that starts with
 * = + - @ (or a tab / CR) would be executed by Excel / Sheets, so it is prefixed with an apostrophe.
 * User-controlled text (names, addresses) flows into these exports, so this matters.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // Leading BOM so Excel opens UTF-8 (₹, Indian-language names) correctly.
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export type ExportType = 'rides' | 'payments' | 'users';

export async function buildExport(type: ExportType, range: '7d' | '30d' | '90d' | 'all', status?: string): Promise<{ filename: string; csv: string }> {
  const db = createSupabaseAdminClient();
  const since = rangeStart(range);
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === 'rides') {
    let request = db.from('rides').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS);
    if (since) request = request.gte('created_at', since);
    if (status && status !== 'all' && status !== 'active') request = request.eq('status', status as 'completed');
    const { data, error } = await request;
    if (error) throw new Error(`Export failed: ${error.message}`);
    return {
      filename: `cabgo-rides-${stamp}.csv`,
      csv: toCsv(
        ['Ride ID', 'Created', 'Status', 'Vehicle', 'Pickup', 'Drop-off', 'Distance (km)', 'Duration (min)', 'Surge', 'Estimated fare', 'Final fare', 'Discount', 'Cancellation fee', 'Cancelled reason'],
        (data ?? []).map((ride) => [ride.id, ride.created_at, ride.status, ride.ride_type, ride.pickup_address, ride.dropoff_address, ride.distance_km, ride.duration_minutes, ride.surge_multiplier, ride.estimated_fare, ride.final_fare, ride.discount_amount, ride.cancellation_fee, ride.cancellation_reason]),
      ),
    };
  }

  if (type === 'payments') {
    let request = db.from('payments').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS);
    if (since) request = request.gte('created_at', since);
    if (status && status !== 'all') request = request.eq('status', status as 'completed');
    const { data, error } = await request;
    if (error) throw new Error(`Export failed: ${error.message}`);
    return {
      filename: `cabgo-payments-${stamp}.csv`,
      csv: toCsv(
        ['Payment ID', 'Created', 'Status', 'Ride ID', 'Amount', 'Currency', 'Method', 'Platform fee', 'Driver earnings', 'Stripe payment intent', 'Failure reason'],
        (data ?? []).map((p) => [p.id, p.created_at, p.status, p.ride_id, p.amount, p.currency, p.payment_method, p.platform_fee, p.driver_earnings, p.stripe_payment_intent_id, p.failure_reason]),
      ),
    };
  }

  let request = db.from('users').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS);
  if (since) request = request.gte('created_at', since);
  if (status && ['rider', 'driver', 'admin'].includes(status)) request = request.eq('role', status as 'rider');
  const { data, error } = await request;
  if (error) throw new Error(`Export failed: ${error.message}`);
  return {
    filename: `cabgo-users-${stamp}.csv`,
    csv: toCsv(
      ['User ID', 'Joined', 'Name', 'Email', 'Phone', 'Role', 'Active', 'Onboarded'],
      (data ?? []).map((u) => [u.id, u.created_at, u.full_name, u.email, u.phone, u.role, u.is_active ? 'yes' : 'no', u.onboarding_completed ? 'yes' : 'no']),
    ),
  };
}
