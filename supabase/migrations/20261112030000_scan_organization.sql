-- Phase 3: Per-user scan organization, separated from raw scan evidence.
-- Safe to run once. Existing scans and security history remain unchanged.
create table if not exists public.scan_organization (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid not null,
  scan_type text not null check (scan_type in ('email','url','attachment')),
  starred boolean not null default false,
  label text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scan_type, scan_id),
  constraint scan_organization_label_limit check (char_length(label) <= 80),
  constraint scan_organization_note_limit check (char_length(note) <= 1000)
);
create index if not exists scan_organization_user_idx
  on public.scan_organization (user_id, starred, updated_at desc);
alter table public.scan_organization enable row level security;
grant select, insert, update, delete on public.scan_organization to authenticated;

-- No administrative policies; everyone only sees and edits their own data.
drop policy if exists "scan_organization_select_own" on public.scan_organization;
create policy "scan_organization_select_own" on public.scan_organization
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "scan_organization_insert_own" on public.scan_organization;
create policy "scan_organization_insert_own" on public.scan_organization
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "scan_organization_update_own" on public.scan_organization;
create policy "scan_organization_update_own" on public.scan_organization
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "scan_organization_delete_own" on public.scan_organization;
create policy "scan_organization_delete_own" on public.scan_organization
for delete to authenticated using ((select auth.uid()) = user_id);

-- Remove organization metadata when its original scan is deleted.
create or replace function public.remove_deleted_scan_organization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.scan_organization
  where scan_id = old.id and user_id = old.user_id and
    (scan_type = 'email' and TG_TABLE_NAME = 'scans'
     or scan_type in ('url','attachment') and TG_TABLE_NAME = 'security_scan_history');
  return old;
end; $$;
drop trigger if exists scans_clear_organization on public.scans;
create trigger scans_clear_organization after delete on public.scans
for each row execute function public.remove_deleted_scan_organization();
drop trigger if exists security_history_clear_organization on public.security_scan_history;
create trigger security_history_clear_organization after delete on public.security_scan_history
for each row execute function public.remove_deleted_scan_organization();
notify pgrst, 'reload schema';
