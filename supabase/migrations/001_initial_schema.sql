-- StackPulse initial schema.
-- Monitoring workers use a trusted server-side Supabase service-role client. The
-- service role bypasses RLS; browser clients can only manage their own monitors
-- and read monitoring results that belong to those monitors.

create extension if not exists pgcrypto;

-- A URL owned by a Supabase Auth user that should be checked by a worker.
create table public.monitors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  url text not null check (url ~* '^https?://'),
  expected_http_status smallint not null default 200
    check (expected_http_status between 100 and 599),
  check_interval_seconds smallint not null default 60
    check (check_interval_seconds in (30, 60, 120)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.monitors is 'User-owned endpoints configured for StackPulse checks.';
comment on column public.monitors.check_interval_seconds is 'Permitted check intervals: 30, 60, or 120 seconds.';

-- One result per worker attempt. A failed network request may not have an HTTP
-- status or latency, so those fields intentionally allow NULL.
create table public.monitor_checks (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  checked_at timestamptz not null default now(),
  http_status smallint check (http_status between 100 and 599),
  response_latency_ms integer check (response_latency_ms >= 0),
  is_success boolean not null,
  tls_expires_at timestamptz,
  error_details text
);

comment on table public.monitor_checks is 'Immutable endpoint check results written by trusted monitoring workers.';
comment on column public.monitor_checks.tls_expires_at is 'Reported TLS certificate expiry, when a TLS certificate was available.';

-- A contiguous failure period for a monitor. The worker opens and resolves
-- incidents; customers can only read incidents for their own monitors.
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  failure_reason text not null check (char_length(trim(failure_reason)) > 0),
  status text not null default 'open' check (status in ('open', 'resolved')),
  check (
    (status = 'open' and resolved_at is null) or
    (status = 'resolved' and resolved_at is not null and resolved_at >= opened_at)
  )
);

comment on table public.incidents is 'Worker-managed outage windows for monitored endpoints.';

-- TrustPulse uses this record to determine whether each trusted worker is
-- reporting in. It is intentionally not exposed to browser clients.
create table public.worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  worker_identifier text not null unique check (char_length(trim(worker_identifier)) > 0),
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.worker_heartbeats is 'Private TrustPulse worker liveness records, managed by trusted backend services.';

-- The common owner and monitor/time lookups used by dashboard and worker flows.
create index monitors_owner_id_idx on public.monitors (owner_id);
create index monitor_checks_monitor_id_checked_at_idx on public.monitor_checks (monitor_id, checked_at desc);
create index incidents_monitor_id_status_opened_at_idx on public.incidents (monitor_id, status, opened_at desc);
create unique index incidents_one_open_per_monitor_idx
  on public.incidents (monitor_id)
  where status = 'open';
create index worker_heartbeats_last_heartbeat_at_idx on public.worker_heartbeats (last_heartbeat_at desc);

-- Defense in depth: browser roles get only the table permissions explicitly
-- needed below. No permissions are granted to anon, and checks/incidents/
-- heartbeats have no client-side write access.
revoke all on public.monitors, public.monitor_checks, public.incidents, public.worker_heartbeats from anon;
revoke all on public.monitors, public.monitor_checks, public.incidents, public.worker_heartbeats from authenticated;

grant select, insert, update, delete on public.monitors to authenticated;
grant select on public.monitor_checks, public.incidents to authenticated;

alter table public.monitors enable row level security;
alter table public.monitor_checks enable row level security;
alter table public.incidents enable row level security;
alter table public.worker_heartbeats enable row level security;

-- Owners may create and manage only monitors assigned to their own Auth user.
create policy "Users can view own monitors"
  on public.monitors for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create own monitors"
  on public.monitors for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update own monitors"
  on public.monitors for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete own monitors"
  on public.monitors for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Check results and incidents are visible only through a monitor owned by the
-- requesting user. No INSERT/UPDATE/DELETE policy exists for these tables:
-- only the trusted backend (using server-side service-role credentials) writes them.
create policy "Users can view checks for own monitors"
  on public.monitor_checks for select to authenticated
  using (
    exists (
      select 1 from public.monitors
      where monitors.id = monitor_checks.monitor_id
        and monitors.owner_id = (select auth.uid())
    )
  );

create policy "Users can view incidents for own monitors"
  on public.incidents for select to authenticated
  using (
    exists (
      select 1 from public.monitors
      where monitors.id = incidents.monitor_id
        and monitors.owner_id = (select auth.uid())
    )
  );

-- worker_heartbeats intentionally has no browser-facing policy. With RLS on
-- and no grants to anon/authenticated, it is accessible only to trusted backend roles.
