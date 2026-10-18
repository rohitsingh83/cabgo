-- Minimal stand-in for the parts of Supabase that CabGo's migrations depend on, so the SQL can be
-- applied to a vanilla Postgres (CI, local experiments). NEVER run this against a real Supabase
-- project — it already provides all of this.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to current_user;

-- auth.jwt(): Supabase exposes the verified JWT claims through this setting.
create schema auth;
create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

-- Storage: buckets + objects (the migration inserts buckets and adds policies on objects).
create schema storage;
create table storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
alter table storage.objects enable row level security;
-- Folder segments of an object path, excluding the file name (same semantics as Supabase).
create function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;

-- Realtime publication that migration 007 adds tables to.
create publication supabase_realtime;

-- Supabase grants the API roles access to everything in `public`; RLS does the real filtering.
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
