-- EmailDetection: append-only per-user audit events for saved scans.
-- Execute in Supabase SQL Editor BEFORE deploying code.
create table if not exists public.scan_audit_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 scan_id uuid not null,
 scan_type text not null check (scan_type in ('email','url','attachment')),
 event_type text not null check (event_type in ('result_saved','analysis_summary','scan_deleted')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists scan_audit_by_owner_scan
 on public.scan_audit_events (user_id, scan_type, scan_id, created_at, id);
alter table public.scan_audit_events enable row level security;
-- Drop by name so repeated runs won't duplicate policies.
drop policy if exists scan_audit_read_own on public.scan_audit_events;
create policy scan_audit_read_own on public.scan_audit_events
 for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists scan_audit_insert_own on public.scan_audit_events;
create policy scan_audit_insert_own on public.scan_audit_events
 for insert to authenticated
 with check (user_id = (select auth.uid()));
-- No UPDATE/DELETE policies. Audit records survive deletion of a scan,
-- but are deleted if the user's auth account is deleted.
revoke all on public.scan_audit_events from anon;
grant select, insert on public.scan_audit_events to authenticated;
