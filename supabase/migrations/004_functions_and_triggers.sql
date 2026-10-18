-- =====================================================================
-- CabGo — Migration 004: helper functions & triggers
--
-- Auth model
--  Clerk issues the JWT (Supabase "Third-party auth" → Clerk, or a JWT template
--  signed with the Supabase JWT secret). The Clerk user id is the `sub` claim.
--  `public.requesting_clerk_id()` reads it and `public.current_user_id()` maps it
--  to public.users.id. Server routes using the service-role key bypass RLS.
--
-- Guard triggers only restrict the Postgres roles `authenticated` / `anon`
-- (i.e. direct browser access). Service-role and postgres sessions are trusted.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identity helpers (SECURITY DEFINER so policies can call them without RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.requesting_clerk_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from public.users u where u.clerk_id = public.requesting_clerk_id() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.role = 'admin' and u.is_active
       from public.users u
      where u.clerk_id = public.requesting_clerk_id()
      limit 1),
    false
  );
$$;

-- Raises unless the caller is an admin, the service role, or a direct (non-API) connection.
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if nullif(current_setting('request.jwt.claims', true), '') is null then
    return; -- direct database connection (SQL editor / migrations)
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_admin() then
    return;
  end if;
  raise exception 'Admin access required' using errcode = '42501';
end;
$$;

create or replace function public.is_verified_online_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.driver_profiles dp
     where dp.user_id = public.current_user_id()
       and dp.is_verified
       and dp.is_online
  );
$$;

create or replace function public.is_ride_participant(p_ride_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rides r
     where r.id = p_ride_id
       and public.current_user_id() in (r.rider_id, r.driver_id)
  );
$$;

-- Can the current user see another user's basic profile? (ride counterpart / open requests)
create or replace function public.can_view_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id = public.current_user_id()
    or public.is_admin()
    or exists (
      select 1 from public.rides r
       where (r.rider_id = p_user_id and r.driver_id = public.current_user_id())
          or (r.driver_id = p_user_id and r.rider_id = public.current_user_id())
    )
    or (
      public.is_verified_online_driver()
      and exists (
        select 1 from public.rides r
         where r.rider_id = p_user_id
           and r.status in ('requested', 'searching')
           and r.driver_id is null
      )
    );
$$;

-- ---------------------------------------------------------------------
-- Generic: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_driver_profiles_updated_at before update on public.driver_profiles
  for each row execute function public.set_updated_at();
create trigger trg_rides_updated_at before update on public.rides
  for each row execute function public.set_updated_at();
create trigger trg_payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger trg_support_tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- users: prevent privilege escalation from the browser
-- ---------------------------------------------------------------------
create or replace function public.users_before_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.clerk_id := old.clerk_id;
    new.is_active := old.is_active;
    if new.role is distinct from old.role then
      -- Role can be picked once during onboarding (rider/driver), never to admin.
      if new.role = 'admin' or old.onboarding_completed then
        raise exception 'Role cannot be changed' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_users_before_update before update on public.users
  for each row execute function public.users_before_update();

-- ---------------------------------------------------------------------
-- driver_profiles: verification fields are admin-only + consistency rules
-- ---------------------------------------------------------------------
create or replace function public.driver_profiles_before_write()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verification_status := 'pending';
      new.is_verified := false;
      new.verified_at := null;
      new.verified_by := null;
      new.rejection_reason := null;
      new.average_rating := 5.00;
      new.rating_count := 0;
      new.total_rides := 0;
      new.is_online := false;
    else
      new.user_id := old.user_id;
      new.verification_status := old.verification_status;
      new.is_verified := old.is_verified;
      new.verified_at := old.verified_at;
      new.verified_by := old.verified_by;
      new.rejection_reason := old.rejection_reason;
      new.average_rating := old.average_rating;
      new.rating_count := old.rating_count;
      new.total_rides := old.total_rides;
    end if;
  end if;

  -- Keep `is_verified` and `verification_status` in sync.
  if tg_op = 'UPDATE'
     and new.is_verified is distinct from old.is_verified
     and new.verification_status is not distinct from old.verification_status then
    new.verification_status :=
      case when new.is_verified then 'approved'::public.verification_status
           else 'pending'::public.verification_status end;
  else
    new.is_verified := (new.verification_status = 'approved');
  end if;

  if new.is_verified and new.verified_at is null then
    new.verified_at := now();
  end if;
  if new.verification_status = 'approved' then
    new.rejection_reason := null;
  end if;

  -- Unverified drivers can never be online.
  if not new.is_verified then
    new.is_online := false;
  end if;

  -- Track freshness of the last known location.
  if new.current_lat is not null and new.current_lng is not null then
    if tg_op = 'INSERT'
       or new.current_lat is distinct from old.current_lat
       or new.current_lng is distinct from old.current_lng then
      new.last_location_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_driver_profiles_before_write before insert or update on public.driver_profiles
  for each row execute function public.driver_profiles_before_write();

-- ---------------------------------------------------------------------
-- rides: state machine, timestamps, client-side tamper protection
-- ---------------------------------------------------------------------
create or replace function public.ride_transition_allowed(p_old public.ride_status, p_new public.ride_status)
returns boolean
language sql
immutable
as $$
  select case p_old
    when 'requested'       then p_new in ('searching', 'accepted', 'cancelled')
    when 'searching'       then p_new in ('requested', 'accepted', 'cancelled')
    when 'accepted'        then p_new in ('driver_arriving', 'cancelled')
    when 'driver_arriving' then p_new in ('in_progress', 'cancelled')
    when 'in_progress'     then p_new in ('completed', 'cancelled')
    else false  -- completed / cancelled are terminal
  end;
$$;

create or replace function public.rides_before_write()
returns trigger
language plpgsql
as $$
declare
  v_client boolean := current_user in ('authenticated', 'anon');
  v_admin  boolean := false;
  v_me     uuid;
begin
  if v_client then
    v_admin := public.is_admin();
    v_me := public.current_user_id();
  end if;

  -- ---------------------------------------------------------------- INSERT
  if tg_op = 'INSERT' then
    if new.status in ('accepted', 'driver_arriving', 'in_progress', 'completed') and new.accepted_at is null then
      new.accepted_at := coalesce(new.created_at, now());
    end if;
    if new.status in ('in_progress', 'completed') and new.started_at is null then
      new.started_at := coalesce(new.accepted_at, now());
    end if;
    if new.status = 'completed' then
      new.completed_at := coalesce(new.completed_at, now());
      new.final_fare := coalesce(new.final_fare, new.estimated_fare);
    end if;
    if new.status = 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;
    return new;
  end if;

  -- ---------------------------------------------------------------- UPDATE
  -- Browser clients can never touch money / ownership fields.
  if v_client and not v_admin then
    new.rider_id := old.rider_id;
    new.estimated_fare := old.estimated_fare;
    new.final_fare := old.final_fare;
    new.discount_amount := old.discount_amount;
    new.cancellation_fee := old.cancellation_fee;
    new.fare_breakdown := old.fare_breakdown;
    new.distance_km := old.distance_km;
    new.duration_minutes := old.duration_minutes;
    new.surge_multiplier := old.surge_multiplier;
    new.promo_code_id := old.promo_code_id;
    new.driver_id := old.driver_id;

    -- Riders may only cancel; they cannot move a ride forward.
    if new.status is distinct from old.status and v_me = old.rider_id and new.status <> 'cancelled' then
      raise exception 'Riders can only cancel a ride' using errcode = '42501';
    end if;
  end if;

  if old.driver_id is not null and new.driver_id is distinct from old.driver_id then
    raise exception 'Driver cannot be changed once a ride is accepted' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if not public.ride_transition_allowed(old.status, new.status) then
      raise exception 'Invalid ride status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    case new.status
      when 'accepted'    then new.accepted_at  := coalesce(new.accepted_at, now());
      when 'in_progress' then new.started_at   := coalesce(new.started_at, now());
      when 'completed'   then
        new.completed_at := coalesce(new.completed_at, now());
        new.final_fare   := coalesce(new.final_fare, new.estimated_fare);
      when 'cancelled'   then new.cancelled_at := coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;

  return new;
end;
$$;

create trigger trg_rides_before_write before insert or update on public.rides
  for each row execute function public.rides_before_write();

-- Atomically redeem a promo code when a ride is created (race-safe).
create or replace function public.rides_redeem_promo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if new.promo_code_id is null then
    return new;
  end if;

  update public.promo_codes pc
     set current_uses = pc.current_uses + 1
   where pc.id = new.promo_code_id
     and pc.is_active
     and now() >= pc.valid_from
     and now() <= pc.valid_until
     and (pc.max_uses is null or pc.current_uses < pc.max_uses)
  returning pc.id into v_id;

  if v_id is null then
    raise exception 'Promo code is invalid, expired or fully redeemed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_rides_redeem_promo before insert on public.rides
  for each row execute function public.rides_redeem_promo();

-- After-write: bump driver ride counter, release promo use on free cancellation.
create or replace function public.rides_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and new.driver_id is not null then
    update public.driver_profiles
       set total_rides = total_rides + 1
     where user_id = new.driver_id;
  end if;

  if tg_op = 'UPDATE'
     and new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and new.promo_code_id is not null
     and coalesce(new.cancellation_fee, 0) = 0 then
    update public.promo_codes
       set current_uses = greatest(current_uses - 1, 0)
     where id = new.promo_code_id;
  end if;

  return null;
end;
$$;

create trigger trg_rides_after_write after insert or update on public.rides
  for each row execute function public.rides_after_write();

-- ---------------------------------------------------------------------
-- ratings: validate participants + recompute the driver's average
-- ---------------------------------------------------------------------
create or replace function public.ratings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = new.ride_id;
  if not found then
    raise exception 'Ride not found' using errcode = '23503';
  end if;
  if v_ride.status <> 'completed' then
    raise exception 'Only completed rides can be rated' using errcode = '23514';
  end if;
  if not (
    (new.from_user_id = v_ride.rider_id  and new.to_user_id = v_ride.driver_id) or
    (new.from_user_id = v_ride.driver_id and new.to_user_id = v_ride.rider_id)
  ) then
    raise exception 'Ratings must be between the rider and driver of the ride' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_ratings_before_insert before insert on public.ratings
  for each row execute function public.ratings_before_insert();

create or replace function public.ratings_refresh_driver_average()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := coalesce(new.to_user_id, old.to_user_id);
begin
  update public.driver_profiles dp
     set average_rating = coalesce(
           (select round(avg(r.rating)::numeric, 2) from public.ratings r where r.to_user_id = v_user),
           5.00),
         rating_count = (select count(*) from public.ratings r where r.to_user_id = v_user)
   where dp.user_id = v_user;
  return null;
end;
$$;

create trigger trg_ratings_refresh_average after insert or update or delete on public.ratings
  for each row execute function public.ratings_refresh_driver_average();

-- ---------------------------------------------------------------------
-- notifications / support / sos / emergency contacts
-- ---------------------------------------------------------------------
create or replace function public.notifications_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.is_read and (tg_op = 'INSERT' or old.is_read is distinct from true) then
    new.read_at := coalesce(new.read_at, now());
  elsif not new.is_read then
    new.read_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_notifications_before_write before insert or update on public.notifications
  for each row execute function public.notifications_before_write();

create or replace function public.support_tickets_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' then
    new.resolved_at := coalesce(new.resolved_at, now());
  else
    new.resolved_at := null;
  end if;

  -- Customers cannot edit admin fields or reopen/resolve tickets from the browser.
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.status := old.status;
    new.admin_response := old.admin_response;
    new.resolved_by := old.resolved_by;
    new.resolved_at := old.resolved_at;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

create trigger trg_support_tickets_before_write before insert or update on public.support_tickets
  for each row execute function public.support_tickets_before_write();

create or replace function public.sos_alerts_before_write()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' then
    new.resolved_at := coalesce(new.resolved_at, now());
  else
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  return new;
end;
$$;

create trigger trg_sos_alerts_before_write before insert or update on public.sos_alerts
  for each row execute function public.sos_alerts_before_write();

create or replace function public.emergency_contacts_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.emergency_contacts where user_id = new.user_id) >= 5 then
    raise exception 'You can save at most 5 emergency contacts' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_emergency_contacts_limit before insert on public.emergency_contacts
  for each row execute function public.emergency_contacts_limit();
