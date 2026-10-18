-- =====================================================================
-- CabGo — Migration 007: Storage buckets + Realtime publication
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
