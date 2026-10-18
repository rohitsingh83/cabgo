-- =====================================================================
-- CabGo — Migration 005: RPC functions (called via supabase.rpc)
-- =====================================================================

-- ---------------------------------------------------------------------
-- find_nearby_drivers — Haversine search with bounding-box pre-filter.
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
-- accept_ride — "first driver to accept wins".
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
-- update_driver_location — throttled persistence of the driver's last position
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
-- validate_promo_code — safe for riders (promo_codes table is admin-only via RLS)
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
