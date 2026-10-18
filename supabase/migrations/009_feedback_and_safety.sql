-- =====================================================================
-- 009 — feedback & safety hardening
--
--  * One ACTIVE SOS alert per user per ride. A double tap (or two devices) can never create two
--    alerts: the second INSERT fails with 23505 and the API returns the existing alert instead.
--  * Support-ticket listing by status/category for the admin queue.
-- =====================================================================
create unique index if not exists sos_alerts_one_active_per_user_ride
  on public.sos_alerts (ride_id, user_id)
  where status = 'active';

create index if not exists support_tickets_category_idx
  on public.support_tickets (category, created_at desc);
