-- =====================================================================
-- CabGo â€” Migration 001: extensions & enum types
-- Run order: 001 â†’ 007 (Supabase SQL editor, or `supabase db push`)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- fast ILIKE search on names / emails (admin tables)

-- ---------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('rider', 'driver', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vehicle_type as enum ('sedan', 'suv', 'auto', 'bike');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ride_status as enum (
    'requested', 'searching', 'accepted', 'driver_arriving', 'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'completed', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percentage', 'flat');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum ('open', 'in_progress', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_category as enum (
    'payment_issue', 'driver_behavior', 'lost_item', 'app_bug', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sos_status as enum ('active', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.saved_place_label as enum ('home', 'work', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'ride_requested', 'ride_accepted', 'driver_arriving', 'ride_started', 'ride_completed',
    'ride_cancelled', 'payment_received', 'payment_failed', 'promo', 'rating_received',
    'driver_verified', 'driver_rejected', 'ticket_update', 'sos', 'system'
  );
exception when duplicate_object then null; end $$;
-- =====================================================================
-- CabGo â€” Migration 002: tables
--
-- Conventions
--  * Every primary key is a UUID (except high-volume ride_locations â†’ bigint identity).
--  * `rides.driver_id`, `payments.driver_id`, `ride_locations.driver_id` reference
--    public.users(id) (the driver's USER id). Vehicle data lives in driver_profiles.
--  * Money is numeric(10,2) in the currency stored on the payment (default INR).
--  * Coordinates are double precision (WGS84).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. users â€” mirrors Clerk users (synced by the Clerk webhook)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id                    uuid primary key default gen_random_uuid(),
  clerk_id              text not null unique,
  email                 text,                       -- nullable: phone-only sign-ups
  phone                 text,
  full_name             text not null default '',
  avatar_url            text,
  role                  public.user_role not null default 'rider',
  onboarding_completed  boolean not null default false,  -- true after role selection
  is_active             boolean not null default true,   -- admin can suspend accounts
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. driver_profiles
-- ---------------------------------------------------------------------
create table if not exists public.driver_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.users(id) on delete cascade,
  license_number        text not null,
  vehicle_type          public.vehicle_type not null,
  vehicle_model         text not null,
  vehicle_color         text not null,
  vehicle_plate         text not null,
  vehicle_year          smallint check (vehicle_year is null or vehicle_year between 1990 and 2100),
  license_document_url  text,                       -- private storage path (driver-documents bucket)
  vehicle_document_url  text,
  verification_status   public.verification_status not null default 'pending',
  rejection_reason      text,
  is_verified           boolean not null default false,
  verified_at           timestamptz,
  verified_by           uuid references public.users(id) on delete set null,
  is_online             boolean not null default false,
  current_lat           double precision check (current_lat is null or current_lat between -90 and 90),
  current_lng           double precision check (current_lng is null or current_lng between -180 and 180),
  current_heading       real check (current_heading is null or current_heading between 0 and 360),
  last_location_at      timestamptz,
  average_rating        numeric(3,2) not null default 5.00 check (average_rating between 0 and 5),
  rating_count          integer not null default 0 check (rating_count >= 0),
  total_rides           integer not null default 0 check (total_rides >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. promo_codes (created before rides because rides reference it)
-- ---------------------------------------------------------------------
create table if not exists public.promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  description     text,
  discount_type   public.discount_type not null,
  discount_value  numeric(10,2) not null check (discount_value > 0),
  max_discount    numeric(10,2) check (max_discount is null or max_discount > 0),  -- cap for % codes
  min_fare        numeric(10,2) not null default 0 check (min_fare >= 0),
  max_uses        integer check (max_uses is null or max_uses > 0),               -- null = unlimited
  current_uses    integer not null default 0 check (current_uses >= 0),
  valid_from      timestamptz not null default now(),
  valid_until     timestamptz not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint promo_codes_percentage_range
    check (discount_type <> 'percentage' or discount_value <= 100),
  constraint promo_codes_valid_window check (valid_until > valid_from)
);

-- ---------------------------------------------------------------------
-- 3. rides
-- ---------------------------------------------------------------------
create table if not exists public.rides (
  id                    uuid primary key default gen_random_uuid(),
  rider_id              uuid not null references public.users(id) on delete cascade,
  driver_id             uuid references public.users(id) on delete set null,
  pickup_address        text not null,
  pickup_lat            double precision not null check (pickup_lat between -90 and 90),
  pickup_lng            double precision not null check (pickup_lng between -180 and 180),
  dropoff_address       text not null,
  dropoff_lat           double precision not null check (dropoff_lat between -90 and 90),
  dropoff_lng           double precision not null check (dropoff_lng between -180 and 180),
  -- Up to 3 intermediate stops: [{ "address": "...", "lat": 0, "lng": 0 }]
  stops                 jsonb not null default '[]'::jsonb,
  ride_type             public.vehicle_type not null,
  status                public.ride_status not null default 'requested',
  estimated_fare        numeric(10,2) not null check (estimated_fare >= 0),
  final_fare            numeric(10,2) check (final_fare is null or final_fare >= 0),
  discount_amount       numeric(10,2) not null default 0 check (discount_amount >= 0),
  cancellation_fee      numeric(10,2) not null default 0 check (cancellation_fee >= 0),
  fare_breakdown        jsonb,                      -- snapshot of the fare calculation
  distance_km           numeric(8,2) not null check (distance_km >= 0),
  duration_minutes      numeric(8,2) not null check (duration_minutes >= 0),
  surge_multiplier      numeric(3,2) not null default 1.00 check (surge_multiplier between 1.00 and 3.00),
  promo_code_id         uuid references public.promo_codes(id) on delete set null,
  route_polyline        text,                       -- encoded overview polyline
  search_radius_km      real not null default 5,
  accepted_at           timestamptz,
  started_at            timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  cancelled_by          uuid references public.users(id) on delete set null,
  cancellation_reason   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint rides_stops_is_array
    check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 3),
  constraint rides_driver_required
    check (status in ('requested', 'searching', 'cancelled') or driver_id is not null),
  constraint rides_rider_not_driver check (rider_id is distinct from driver_id)
);

-- ---------------------------------------------------------------------
-- 4. payments
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id                        uuid primary key default gen_random_uuid(),
  ride_id                   uuid not null references public.rides(id) on delete cascade,
  rider_id                  uuid not null references public.users(id) on delete cascade,
  driver_id                 uuid references public.users(id) on delete set null,
  amount                    numeric(10,2) not null check (amount >= 0),
  currency                  text not null default 'inr',
  stripe_payment_intent_id  text unique,
  stripe_charge_id          text,
  status                    public.payment_status not null default 'pending',
  payment_method            text not null default 'card',   -- card | upi | wallet | cash
  platform_fee              numeric(10,2) not null default 0 check (platform_fee >= 0),
  driver_earnings           numeric(10,2) not null default 0 check (driver_earnings >= 0),
  failure_reason            text,
  receipt_url               text,
  receipt_sent_at           timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. ratings
-- ---------------------------------------------------------------------
create table if not exists public.ratings (
  id            uuid primary key default gen_random_uuid(),
  ride_id       uuid not null references public.rides(id) on delete cascade,
  from_user_id  uuid not null references public.users(id) on delete cascade,
  to_user_id    uuid not null references public.users(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  review_text   text check (review_text is null or char_length(review_text) <= 1000),
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  constraint ratings_one_per_user_per_ride unique (ride_id, from_user_id),
  constraint ratings_not_self check (from_user_id <> to_user_id)
);

-- ---------------------------------------------------------------------
-- 7. ride_locations â€” breadcrumb trail of the driver during a ride
-- ---------------------------------------------------------------------
create table if not exists public.ride_locations (
  id          bigint generated always as identity primary key,
  ride_id     uuid not null references public.rides(id) on delete cascade,
  driver_id   uuid not null references public.users(id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  heading     real,
  speed_kmh   real,
  "timestamp" timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  message     text not null,
  type        public.notification_type not null default 'system',
  is_read     boolean not null default false,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. support_tickets
-- ---------------------------------------------------------------------
create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  ride_id         uuid references public.rides(id) on delete set null,
  category        public.ticket_category not null default 'other',
  subject         text not null check (char_length(subject) between 3 and 200),
  description     text not null check (char_length(description) between 5 and 4000),
  status          public.ticket_status not null default 'open',
  admin_response  text,
  resolved_by     uuid references public.users(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. sos_alerts
-- ---------------------------------------------------------------------
create table if not exists public.sos_alerts (
  id                           uuid primary key default gen_random_uuid(),
  ride_id                      uuid not null references public.rides(id) on delete cascade,
  user_id                      uuid not null references public.users(id) on delete cascade,
  lat                          double precision not null check (lat between -90 and 90),
  lng                          double precision not null check (lng between -180 and 180),
  status                       public.sos_status not null default 'active',
  emergency_contacts_notified  boolean not null default false,
  notified_contacts            jsonb not null default '[]'::jsonb,   -- [{ name, phone, sent }]
  resolved_by                  uuid references public.users(id) on delete set null,
  resolved_at                  timestamptz,
  created_at                   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 11. emergency_contacts
-- ---------------------------------------------------------------------
create table if not exists public.emergency_contacts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 100),
  phone         text not null check (char_length(phone) between 7 and 20),
  relationship  text not null default 'Friend',
  created_at    timestamptz not null default now(),
  constraint emergency_contacts_unique_phone unique (user_id, phone)
);

-- ---------------------------------------------------------------------
-- 12. saved_places
-- ---------------------------------------------------------------------
create table if not exists public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  label       public.saved_place_label not null default 'custom',
  name        text,                                  -- display name for custom places
  address     text not null,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_at  timestamptz not null default now()
);
-- =====================================================================
-- CabGo â€” Migration 003: indexes
-- =====================================================================

-- users ---------------------------------------------------------------
create unique index if not exists users_email_unique on public.users (lower(email)) where email is not null;
create unique index if not exists users_phone_unique on public.users (phone) where phone is not null;
create index if not exists users_role_idx on public.users (role);
create index if not exists users_created_at_idx on public.users (created_at desc);
create index if not exists users_name_trgm_idx on public.users using gin (full_name gin_trgm_ops);
create index if not exists users_email_trgm_idx on public.users using gin (email gin_trgm_ops);

-- driver_profiles -----------------------------------------------------
create unique index if not exists driver_profiles_plate_unique on public.driver_profiles (upper(vehicle_plate));
create index if not exists driver_profiles_verification_idx on public.driver_profiles (verification_status);
-- Matching query: only online + verified drivers, narrowed by vehicle type + bounding box
create index if not exists driver_profiles_matching_idx
  on public.driver_profiles (vehicle_type, current_lat, current_lng)
  where is_online and is_verified;

-- promo_codes ---------------------------------------------------------
create unique index if not exists promo_codes_code_unique on public.promo_codes (upper(code));
create index if not exists promo_codes_active_idx on public.promo_codes (is_active, valid_until);

-- rides ---------------------------------------------------------------
create index if not exists rides_rider_created_idx on public.rides (rider_id, created_at desc);
create index if not exists rides_driver_created_idx on public.rides (driver_id, created_at desc);
create index if not exists rides_status_idx on public.rides (status);
create index if not exists rides_created_at_idx on public.rides (created_at desc);
-- Open requests that online drivers poll for
create index if not exists rides_open_requests_idx
  on public.rides (ride_type, pickup_lat, pickup_lng)
  where status in ('requested', 'searching') and driver_id is null;
-- A driver can only have one active ride at a time
create unique index if not exists rides_one_active_per_driver
  on public.rides (driver_id)
  where status in ('accepted', 'driver_arriving', 'in_progress');
create index if not exists rides_promo_idx on public.rides (promo_code_id) where promo_code_id is not null;

-- payments ------------------------------------------------------------
create index if not exists payments_ride_idx on public.payments (ride_id);
create index if not exists payments_rider_created_idx on public.payments (rider_id, created_at desc);
create index if not exists payments_driver_created_idx on public.payments (driver_id, created_at desc);
create index if not exists payments_status_idx on public.payments (status, created_at desc);

-- ratings -------------------------------------------------------------
create index if not exists ratings_to_user_idx on public.ratings (to_user_id, created_at desc);
create index if not exists ratings_from_user_idx on public.ratings (from_user_id);

-- ride_locations ------------------------------------------------------
create index if not exists ride_locations_ride_ts_idx on public.ride_locations (ride_id, "timestamp");

-- notifications -------------------------------------------------------
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where is_read = false;

-- support_tickets -----------------------------------------------------
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);

-- sos_alerts ----------------------------------------------------------
create index if not exists sos_alerts_active_idx on public.sos_alerts (created_at desc) where status = 'active';
create index if not exists sos_alerts_user_idx on public.sos_alerts (user_id);
create index if not exists sos_alerts_ride_idx on public.sos_alerts (ride_id);

-- emergency_contacts / saved_places ----------------------------------
create index if not exists emergency_contacts_user_idx on public.emergency_contacts (user_id);
create index if not exists saved_places_user_idx on public.saved_places (user_id);
-- At most one Home and one Work place per user
create unique index if not exists saved_places_home_work_unique
  on public.saved_places (user_id, label) where label in ('home', 'work');
-- =====================================================================
-- CabGo â€” Migration 004: helper functions & triggers
--
-- Auth model
--  Clerk issues the JWT (Supabase "Third-party auth" â†’ Clerk, or a JWT template
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
-- =====================================================================
-- CabGo â€” Migration 005: RPC functions (called via supabase.rpc)
-- =====================================================================

-- ---------------------------------------------------------------------
-- find_nearby_drivers â€” Haversine search with bounding-box pre-filter.
-- (No PostGIS dependency; the partial index driver_profiles_matching_idx
--  makes the bounding box scan cheap.)
-- ---------------------------------------------------------------------
create or replace function public.find_nearby_drivers(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_km  double precision default 5,
  p_ride_type  public.vehicle_type default null,
  p_limit      integer default 20
)
returns table (
  driver_user_id     uuid,
  driver_profile_id  uuid,
  full_name          text,
  avatar_url         text,
  vehicle_type       public.vehicle_type,
  vehicle_model      text,
  vehicle_color      text,
  vehicle_plate      text,
  average_rating     numeric,
  total_rides        integer,
  current_lat        double precision,
  current_lng        double precision,
  current_heading    real,
  distance_km        double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lat_delta double precision := p_radius_km / 111.0;
  v_lng_delta double precision := p_radius_km / (111.0 * greatest(cos(radians(p_lat)), 0.01));
begin
  return query
  select
    u.id,
    dp.id,
    u.full_name,
    u.avatar_url,
    dp.vehicle_type,
    dp.vehicle_model,
    dp.vehicle_color,
    dp.vehicle_plate,
    dp.average_rating,
    dp.total_rides,
    dp.current_lat,
    dp.current_lng,
    dp.current_heading,
    d.km
  from public.driver_profiles dp
  join public.users u on u.id = dp.user_id and u.is_active
  cross join lateral (
    select 6371.0 * 2 * asin(sqrt(
      power(sin(radians(dp.current_lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(dp.current_lat)) *
      power(sin(radians(dp.current_lng - p_lng) / 2), 2)
    )) as km
  ) d
  where dp.is_online
    and dp.is_verified
    and dp.current_lat is not null
    and dp.current_lng is not null
    and dp.current_lat between p_lat - v_lat_delta and p_lat + v_lat_delta
    and dp.current_lng between p_lng - v_lng_delta and p_lng + v_lng_delta
    and (p_ride_type is null or dp.vehicle_type = p_ride_type)
    -- ignore drivers whose location is stale (> 5 minutes)
    and dp.last_location_at is not null
    and dp.last_location_at > now() - interval '5 minutes'
    -- skip drivers that are already on a ride
    and not exists (
      select 1 from public.rides r
       where r.driver_id = dp.user_id
         and r.status in ('accepted', 'driver_arriving', 'in_progress')
    )
    and d.km <= p_radius_km
  order by d.km asc
  limit greatest(p_limit, 1);
end;
$$;

revoke all on function public.find_nearby_drivers(double precision, double precision, double precision, public.vehicle_type, integer) from public, anon;
grant execute on function public.find_nearby_drivers(double precision, double precision, double precision, public.vehicle_type, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- accept_ride â€” "first driver to accept wins".
-- The UPDATE ... WHERE driver_id IS NULL is atomic: a second driver blocks on the
-- row lock, re-evaluates the predicate, finds no row and receives RIDE_UNAVAILABLE.
-- Service-role only (called from the Next.js API route).
-- ---------------------------------------------------------------------
create or replace function public.accept_ride(p_ride_id uuid, p_driver_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.driver_profiles;
  v_ride    public.rides;
begin
  select * into v_profile from public.driver_profiles where user_id = p_driver_id;
  if not found or not v_profile.is_verified then
    raise exception 'DRIVER_NOT_VERIFIED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.rides
     where driver_id = p_driver_id
       and status in ('accepted', 'driver_arriving', 'in_progress')
  ) then
    raise exception 'DRIVER_BUSY' using errcode = 'P0001';
  end if;

  update public.rides r
     set driver_id = p_driver_id,
         status = 'accepted'
   where r.id = p_ride_id
     and r.driver_id is null
     and r.status in ('requested', 'searching')
     and r.rider_id <> p_driver_id
     and r.ride_type = v_profile.vehicle_type
  returning r.* into v_ride;

  if not found then
    raise exception 'RIDE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  return v_ride;
end;
$$;

revoke all on function public.accept_ride(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_ride(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- update_driver_location â€” throttled persistence of the driver's last position
-- ---------------------------------------------------------------------
create or replace function public.update_driver_location(
  p_lat      double precision,
  p_lng      double precision,
  p_heading  real default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_user_id();
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  update public.driver_profiles
     set current_lat = p_lat,
         current_lng = p_lng,
         current_heading = p_heading,
         last_location_at = now()
   where user_id = v_user;
end;
$$;

revoke all on function public.update_driver_location(double precision, double precision, real) from public, anon;
grant execute on function public.update_driver_location(double precision, double precision, real) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- validate_promo_code â€” safe for riders (promo_codes table is admin-only via RLS)
-- ---------------------------------------------------------------------
create or replace function public.validate_promo_code(p_code text, p_fare numeric default 0)
returns table (
  valid            boolean,
  message          text,
  promo_id         uuid,
  discount_type    public.discount_type,
  discount_value   numeric,
  discount_amount  numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v      public.promo_codes;
  v_amt  numeric;
begin
  select * into v from public.promo_codes pc where upper(pc.code) = upper(trim(p_code)) limit 1;

  if not found then
    return query select false, 'Invalid promo code'::text, null::uuid, null::public.discount_type, null::numeric, 0::numeric;
    return;
  end if;
  if not v.is_active then
    return query select false, 'This promo code is no longer active'::text, v.id, v.discount_type, v.discount_value, 0::numeric;
    return;
  end if;
  if now() < v.valid_from then
    return query select false, 'This promo code is not valid yet'::text, v.id, v.discount_type, v.discount_value, 0::numeric;
    return;
  end if;
  if now() > v.valid_until then
    return query select false, 'This promo code has expired'::text, v.id, v.discount_type, v.discount_value, 0::numeric;
    return;
  end if;
  if v.max_uses is not null and v.current_uses >= v.max_uses then
    return query select false, 'This promo code has been fully redeemed'::text, v.id, v.discount_type, v.discount_value, 0::numeric;
    return;
  end if;
  if coalesce(p_fare, 0) < v.min_fare then
    return query select false, ('Minimum fare of ' || v.min_fare::text || ' required for this code')::text,
                        v.id, v.discount_type, v.discount_value, 0::numeric;
    return;
  end if;

  v_amt := case
    when v.discount_type = 'percentage' then round(coalesce(p_fare, 0) * v.discount_value / 100.0, 2)
    else v.discount_value
  end;
  if v.max_discount is not null then
    v_amt := least(v_amt, v.max_discount);
  end if;
  v_amt := greatest(least(v_amt, coalesce(p_fare, 0)), 0);

  return query select true, 'Promo code applied'::text, v.id, v.discount_type, v.discount_value, v_amt;
end;
$$;

revoke all on function public.validate_promo_code(text, numeric) from public, anon;
grant execute on function public.validate_promo_code(text, numeric) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Admin analytics
-- ---------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  return jsonb_build_object(
    'total_users',           (select count(*) from public.users),
    'total_riders',          (select count(*) from public.users where role = 'rider'),
    'total_drivers',         (select count(*) from public.users where role = 'driver'),
    'total_rides',           (select count(*) from public.rides),
    'completed_rides',       (select count(*) from public.rides where status = 'completed'),
    'cancelled_rides',       (select count(*) from public.rides where status = 'cancelled'),
    'active_rides',          (select count(*) from public.rides where status in ('accepted', 'driver_arriving', 'in_progress')),
    'rides_today',           (select count(*) from public.rides where created_at >= date_trunc('day', now())),
    'total_revenue',         (select coalesce(sum(amount), 0) from public.payments where status = 'completed'),
    'platform_revenue',      (select coalesce(sum(platform_fee), 0) from public.payments where status = 'completed'),
    'revenue_30d',           (select coalesce(sum(amount), 0) from public.payments where status = 'completed' and created_at >= now() - interval '30 days'),
    'online_drivers',        (select count(*) from public.driver_profiles where is_online and is_verified),
    'pending_verifications', (select count(*) from public.driver_profiles where verification_status = 'pending'),
    'open_tickets',          (select count(*) from public.support_tickets where status in ('open', 'in_progress')),
    'active_sos',            (select count(*) from public.sos_alerts where status = 'active')
  );
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated, service_role;

create or replace function public.admin_daily_stats(p_days integer default 30, p_tz text default 'Asia/Kolkata')
returns table (
  day              date,
  rides_count      bigint,
  completed_count  bigint,
  cancelled_count  bigint,
  revenue          numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_from  date := (now() at time zone p_tz)::date - (greatest(p_days, 1) - 1);
begin
  perform public.assert_admin();

  return query
  with days as (
    select gs::date as d
      from generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') gs
  ),
  rd as (
    select (r.created_at at time zone p_tz)::date as d,
           count(*)                                           as r_total,
           count(*) filter (where r.status = 'completed')     as r_done,
           count(*) filter (where r.status = 'cancelled')     as r_cancel
      from public.rides r
     where (r.created_at at time zone p_tz)::date >= v_from
     group by 1
  ),
  pd as (
    select (p.created_at at time zone p_tz)::date as d,
           sum(p.amount) as p_rev
      from public.payments p
     where p.status = 'completed'
       and (p.created_at at time zone p_tz)::date >= v_from
     group by 1
  )
  select days.d,
         coalesce(rd.r_total, 0)::bigint,
         coalesce(rd.r_done, 0)::bigint,
         coalesce(rd.r_cancel, 0)::bigint,
         coalesce(pd.p_rev, 0)::numeric
    from days
    left join rd on rd.d = days.d
    left join pd on pd.d = days.d
   order by days.d;
end;
$$;

revoke all on function public.admin_daily_stats(integer, text) from public, anon;
grant execute on function public.admin_daily_stats(integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Driver earnings per day (driver dashboard chart)
-- ---------------------------------------------------------------------
create or replace function public.driver_earnings_summary(
  p_driver_id uuid,
  p_days      integer default 30,
  p_tz        text default 'Asia/Kolkata'
)
returns table (
  day          date,
  rides_count  bigint,
  earnings     numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_from  date := (now() at time zone p_tz)::date - (greatest(p_days, 1) - 1);
begin
  if nullif(current_setting('request.jwt.claims', true), '') is not null
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and p_driver_id is distinct from public.current_user_id()
     and not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  with days as (
    select gs::date as d
      from generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') gs
  ),
  pd as (
    select (p.created_at at time zone p_tz)::date as d,
           count(*)                 as p_rides,
           sum(p.driver_earnings)   as p_earn
      from public.payments p
     where p.driver_id = p_driver_id
       and p.status = 'completed'
       and (p.created_at at time zone p_tz)::date >= v_from
     group by 1
  )
  select days.d,
         coalesce(pd.p_rides, 0)::bigint,
         coalesce(pd.p_earn, 0)::numeric
    from days
    left join pd on pd.d = days.d
   order by days.d;
end;
$$;

revoke all on function public.driver_earnings_summary(uuid, integer, text) from public, anon;
grant execute on function public.driver_earnings_summary(uuid, integer, text) to authenticated, service_role;
-- =====================================================================
-- CabGo â€” Migration 006: Row Level Security
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
-- promo_codes â€” admin only. Riders validate through public.validate_promo_code().
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
-- emergency_contacts / saved_places â€” owner full access
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
-- =====================================================================
-- CabGo â€” Migration 007: Storage buckets + Realtime publication
--
-- Object paths are `<users.id>/<filename>` so policies can compare the first
-- folder with the caller's user id.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Buckets
--  avatars           public read   (profile pictures, 5 MB, images only)
--  receipts          private       (PDF/HTML receipts written by the server)
--  driver-documents  private       (licence / RC uploads reviewed by admins)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts', 'receipts', false, 5242880, array['application/pdf', 'text/html']),
  ('driver-documents', 'driver-documents', false, 10485760,
     array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_user_id()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_user_id()::text);

drop policy if exists "receipts_owner_select" on storage.objects;
create policy "receipts_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = public.current_user_id()::text or public.is_admin())
  );

drop policy if exists "driver_docs_owner_insert" on storage.objects;
create policy "driver_docs_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = public.current_user_id()::text
  );

drop policy if exists "driver_docs_owner_select" on storage.objects;
create policy "driver_docs_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'driver-documents'
    and ((storage.foldername(name))[1] = public.current_user_id()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------
-- Realtime: stream ride + notification changes to subscribed clients
-- (RLS applies to Realtime, so users only receive rows they may read)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['rides', 'notifications', 'sos_alerts', 'support_tickets'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then
        null; -- already part of the publication
      end;
    end loop;
  end if;
end $$;
-- =====================================================================
-- 008 â€” payments integrity
--
-- Exactly ONE live payment record per ride. A ride is paid once; failed attempts reuse the same
-- row (pending â†’ failed â†’ pending â†’ completed), and only a refund frees the ride for a new row.
-- This also makes double-submits and webhook/confirm races safe: the second INSERT fails with
-- 23505 and the service simply re-reads the existing row.
-- =====================================================================
create unique index if not exists payments_one_active_per_ride
  on public.payments (ride_id)
  where status <> 'refunded';

comment on index public.payments_one_active_per_ride is
  'At most one non-refunded payment per ride (see src/lib/payments).';
-- =====================================================================
-- 009 â€” feedback & safety hardening
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
