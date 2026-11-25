-- Persistent in-app notifications for incident transitions. Run after 001-003.
-- This migration preserves existing RLS policies and table grants.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  type text not null check (type in ('incident_opened', 'incident_resolved')),
  title text not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (incident_id, type)
);

comment on table public.notifications is 'Owner-scoped in-app notices generated from incident state transitions.';

create index notifications_owner_created_at_idx
  on public.notifications (owner_id, created_at desc);
create index notifications_owner_unread_idx
  on public.notifications (owner_id, created_at desc)
  where read_at is null;

revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;
grant select, update on public.notifications to authenticated;

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can mark own notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- A trusted, database-owned trigger records incident events. The unique
-- constraint makes retries and concurrent workers idempotent. Notification
-- failures are deliberately isolated so they cannot roll back an incident
-- transition. It does not expose this privileged function to clients.
create or replace function public.create_incident_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  notification_owner_id uuid;
  notification_type text;
  notification_title text;
  notification_body text;
begin
  if tg_op = 'INSERT' and new.status = 'open' then
    notification_type := 'incident_opened';
    notification_title := 'Monitor incident opened';
    notification_body := new.failure_reason;
  elsif tg_op = 'UPDATE' and old.status = 'open' and new.status = 'resolved' then
    notification_type := 'incident_resolved';
    notification_title := 'Monitor incident resolved';
    notification_body := 'A successful check resolved the active incident.';
  else
    return new;
  end if;

  select owner_id into notification_owner_id
  from public.monitors
  where id = new.monitor_id;

  if notification_owner_id is not null then
    begin
      insert into public.notifications (owner_id, monitor_id, incident_id, type, title, body)
      values (notification_owner_id, new.monitor_id, new.id, notification_type, notification_title, notification_body)
      on conflict (incident_id, type) do nothing;
    exception when others then
      raise warning 'StackPulse notification creation failed.';
    end;
  end if;

  return new;
end;
$function$;

revoke all on function public.create_incident_notification() from public;

create trigger incident_notification_after_insert_or_resolution
after insert or update of status on public.incidents
for each row execute function public.create_incident_notification();
