-- =====================================================================
-- CabGo — Migration 006: Row Level Security
--
-- All server routes use the service-role key (bypasses RLS). These policies are
-- the defence-in-depth layer for anything that talks to Supabase from the browser
-- with the user's Clerk token (reads, Realtime subscriptions, simple self-edits).
-- =====================================================================

alter table public.users              enable row level security;
alter table public.driver_profiles    enable row level security;
alter table public.rides              enable row level security;
alter table public.payments           enable row level security;
alter table public.ratings            enable row level security;
alter table public.promo_codes        enable row level security;
alter table public.ride_locations     enable row level security;
alter table public.notifications      enable row level security;
alter table public.support_tickets    enable row level security;
alter table public.sos_alerts         enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.saved_places       enable row level security;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (public.can_view_user(id));

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using (id = public.current_user_id())
  with check (id = public.current_user_id());

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- driver_profiles
-- ---------------------------------------------------------------------
drop policy if exists driver_profiles_select on public.driver_profiles;
create policy driver_profiles_select on public.driver_profiles
  for select to authenticated
  using (user_id = public.current_user_id() or is_verified or public.is_admin());

drop policy if exists driver_profiles_insert_own on public.driver_profiles;
create policy driver_profiles_insert_own on public.driver_profiles
  for insert to authenticated
  with check (user_id = public.current_user_id());

drop policy if exists driver_profiles_update_own on public.driver_profiles;
create policy driver_profiles_update_own on public.driver_profiles
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

drop policy if exists driver_profiles_admin_all on public.driver_profiles;
create policy driver_profiles_admin_all on public.driver_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- rides
-- ---------------------------------------------------------------------
drop policy if exists rides_select on public.rides;
create policy rides_select on public.rides
  for select to authenticated
  using (
    rider_id = public.current_user_id()
    or driver_id = public.current_user_id()
    or (status in ('requested', 'searching') and driver_id is null and public.is_verified_online_driver())
    or public.is_admin()
  );

drop policy if exists rides_insert_rider on public.rides;
create policy rides_insert_rider on public.rides
  for insert to authenticated
  with check (
    rider_id = public.current_user_id()
    and status in ('requested', 'searching')
    and driver_id is null
  );

drop policy if exists rides_update_participants on public.rides;
create policy rides_update_participants on public.rides
  for update to authenticated
  using (rider_id = public.current_user_id() or driver_id = public.current_user_id())
  with check (rider_id = public.current_user_id() or driver_id = public.current_user_id());

drop policy if exists rides_admin_all on public.rides;
create policy rides_admin_all on public.rides
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- payments (read-only from the browser; writes happen server-side / webhooks)
-- ---------------------------------------------------------------------
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated
  using (rider_id = public.current_user_id() or driver_id = public.current_user_id() or public.is_admin());

drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- ratings (reviews are public to signed-in users so they show on driver profiles)
-- ---------------------------------------------------------------------
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings
  for select to authenticated
  using (true);

drop policy if exists ratings_insert_own on public.ratings;
create policy ratings_insert_own on public.ratings
  for insert to authenticated
  with check (from_user_id = public.current_user_id());

drop policy if exists ratings_admin_all on public.ratings;
create policy ratings_admin_all on public.ratings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- promo_codes — admin only. Riders validate through public.validate_promo_code().
-- ---------------------------------------------------------------------
drop policy if exists promo_codes_admin_all on public.promo_codes;
create policy promo_codes_admin_all on public.promo_codes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- ride_locations
-- ---------------------------------------------------------------------
drop policy if exists ride_locations_select on public.ride_locations;
create policy ride_locations_select on public.ride_locations
  for select to authenticated
  using (public.is_ride_participant(ride_id) or public.is_admin());

drop policy if exists ride_locations_insert_driver on public.ride_locations;
create policy ride_locations_insert_driver on public.ride_locations
  for insert to authenticated
  with check (
    driver_id = public.current_user_id()
    and exists (
      select 1 from public.rides r
       where r.id = ride_id
         and r.driver_id = public.current_user_id()
         and r.status in ('accepted', 'driver_arriving', 'in_progress')
    )
  );

-- ---------------------------------------------------------------------
-- notifications (insert is server-side only)
-- ---------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = public.current_user_id());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = public.current_user_id());

drop policy if exists notifications_admin_all on public.notifications;
create policy notifications_admin_all on public.notifications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------
drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select to authenticated
  using (user_id = public.current_user_id());

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (user_id = public.current_user_id() and status = 'open');

drop policy if exists support_tickets_update_own on public.support_tickets;
create policy support_tickets_update_own on public.support_tickets
  for update to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

drop policy if exists support_tickets_admin_all on public.support_tickets;
create policy support_tickets_admin_all on public.support_tickets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- sos_alerts
-- ---------------------------------------------------------------------
drop policy if exists sos_alerts_select_own on public.sos_alerts;
create policy sos_alerts_select_own on public.sos_alerts
  for select to authenticated
  using (user_id = public.current_user_id());

drop policy if exists sos_alerts_insert_own on public.sos_alerts;
create policy sos_alerts_insert_own on public.sos_alerts
  for insert to authenticated
  with check (
    user_id = public.current_user_id()
    and status = 'active'
    and public.is_ride_participant(ride_id)
  );

drop policy if exists sos_alerts_admin_all on public.sos_alerts;
create policy sos_alerts_admin_all on public.sos_alerts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- emergency_contacts / saved_places — owner full access
-- ---------------------------------------------------------------------
drop policy if exists emergency_contacts_owner on public.emergency_contacts;
create policy emergency_contacts_owner on public.emergency_contacts
  for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

drop policy if exists emergency_contacts_admin_select on public.emergency_contacts;
create policy emergency_contacts_admin_select on public.emergency_contacts
  for select to authenticated
  using (public.is_admin());

drop policy if exists saved_places_owner on public.saved_places;
create policy saved_places_owner on public.saved_places
  for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());
