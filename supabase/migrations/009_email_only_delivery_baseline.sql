-- Email-only notification delivery baseline. Apply directly after 004 ONLY in
-- databases where read-only verification confirms 005-008 objects are absent.
-- This migration does not remove Telegram tables from environments that may
-- already contain Telegram data; use the documented verification procedure
-- and obtain deletion approval before any destructive cleanup.

create table if not exists public.email_notification_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  incident_open_enabled boolean not null default true,
  incident_recovery_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel = 'email'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error_category text,
  lease_owner text,
  lease_expires_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);

alter table public.email_notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.email_notification_preferences, public.notification_deliveries from anon;
revoke all on public.email_notification_preferences, public.notification_deliveries from authenticated;
grant select, insert, update on public.email_notification_preferences to authenticated;
grant select on public.notification_deliveries to authenticated;
create policy "Users can manage own email preferences" on public.email_notification_preferences
  for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Users can view own email deliveries" on public.notification_deliveries
  for select to authenticated using ((select auth.uid()) = owner_id);
create index if not exists notification_deliveries_email_lease_idx
  on public.notification_deliveries (status, next_attempt_at, lease_expires_at) where channel = 'email';

-- Missing preference rows are intentionally opt-out: no email is queued until
-- the owner has explicitly configured an email preference row.
create or replace function public.enqueue_email_delivery()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if exists (select 1 from public.email_notification_preferences p where p.owner_id = new.owner_id and ((new.type = 'incident_opened' and p.incident_open_enabled) or (new.type = 'incident_resolved' and p.incident_recovery_enabled))) then
    insert into public.notification_deliveries (notification_id, owner_id, channel)
    values (new.id, new.owner_id, 'email') on conflict (notification_id, channel) do nothing;
  end if;
  return new;
exception when others then raise warning 'StackPulse email delivery enqueue failed.'; return new;
end;
$function$;
revoke all on function public.enqueue_email_delivery() from public;
create trigger notification_email_delivery_after_insert
after insert on public.notifications for each row execute function public.enqueue_email_delivery();

create or replace function public.claim_email_delivery(p_worker_id text, p_lease_seconds integer default 60)
returns table (id uuid, notification_id uuid, owner_id uuid, attempt_count integer, recipient text, subject text, body_text text)
language plpgsql security definer set search_path = '' as $function$
begin
  return query with candidate as (
    select d.id from public.notification_deliveries d join public.notifications n on n.id = d.notification_id join public.email_notification_preferences p on p.owner_id = d.owner_id join auth.users u on u.id = d.owner_id
    where d.channel = 'email' and ((d.status = 'pending' and d.next_attempt_at <= now()) or (d.status = 'processing' and d.lease_expires_at < now()))
      and ((n.type = 'incident_opened' and p.incident_open_enabled) or (n.type = 'incident_resolved' and p.incident_recovery_enabled)) and u.email is not null
    order by d.next_attempt_at, d.created_at for update of d skip locked limit 1
  ), claimed as (
    update public.notification_deliveries d set status = 'processing', lease_owner = p_worker_id, lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 1)), last_attempt_at = now()
    from candidate where d.id = candidate.id returning d.*
  ) select d.id, d.notification_id, d.owner_id, d.attempt_count, u.email, case when n.type = 'incident_opened' then '[StackPulse CRITICAL] ' else '[StackPulse RECOVERY] ' end || n.title, n.body from claimed d join public.notifications n on n.id = d.notification_id join auth.users u on u.id = d.owner_id;
end;
$function$;
revoke all on function public.claim_email_delivery(text, integer) from public;
revoke all on function public.claim_email_delivery(text, integer) from anon, authenticated;
grant execute on function public.claim_email_delivery(text, integer) to service_role;
