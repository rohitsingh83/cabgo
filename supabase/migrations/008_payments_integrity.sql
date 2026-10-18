-- =====================================================================
-- 008 — payments integrity
--
-- Exactly ONE live payment record per ride. A ride is paid once; failed attempts reuse the same
-- row (pending → failed → pending → completed), and only a refund frees the ride for a new row.
-- This also makes double-submits and webhook/confirm races safe: the second INSERT fails with
-- 23505 and the service simply re-reads the existing row.
-- =====================================================================
create unique index if not exists payments_one_active_per_ride
  on public.payments (ride_id)
  where status <> 'refunded';

comment on index public.payments_one_active_per_ride is
  'At most one non-refunded payment per ride (see src/lib/payments).';
