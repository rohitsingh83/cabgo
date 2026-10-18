-- =====================================================================
-- CabGo — Migration 001: extensions & enum types
-- Run order: 001 → 007 (Supabase SQL editor, or `supabase db push`)
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
