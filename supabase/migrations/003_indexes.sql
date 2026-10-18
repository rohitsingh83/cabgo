-- =====================================================================
-- CabGo — Migration 003: indexes
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
