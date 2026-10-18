-- =====================================================================
-- CabGo — Migration 002: tables
--
-- Conventions
--  * Every primary key is a UUID (except high-volume ride_locations → bigint identity).
--  * `rides.driver_id`, `payments.driver_id`, `ride_locations.driver_id` reference
--    public.users(id) (the driver's USER id). Vehicle data lives in driver_profiles.
--  * Money is numeric(10,2) in the currency stored on the payment (default INR).
--  * Coordinates are double precision (WGS84).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. users — mirrors Clerk users (synced by the Clerk webhook)
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
-- 7. ride_locations — breadcrumb trail of the driver during a ride
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
