-- Email delivery settings and queue support. Run after 005. Provider secrets
-- remain exclusively in the trusted dispatcher environment.

create table public.email_notification_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  incident_open_enabled boolean not null default true,
  incident_recovery_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.email_notification_preferences enable row level security;
revoke all on public.email_notification_preferences from anon;
revoke all on public.email_notification_preferences from authenticated;
grant select, insert, update on public.email_notification_preferences to authenticated;
create policy "Users can manage own email preferences" on public.email_notification_preferences
  for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

alter table public.notification_deliveries drop constraint notification_deliveries_channel_check;
alter table public.notification_deliveries add constraint notification_deliveries_channel_check check (channel in ('telegram', 'email'));

-- Replace the queue trigger so it creates a durable email delivery only when
-- the owner opted into the relevant incident event. Failures cannot roll back
-- the notification or incident transition.
create or replace function public.enqueue_telegram_delivery()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if exists (select 1 from public.telegram_connections where owner_id = new.owner_id) then
    insert into public.notification_deliveries (notification_id, owner_id, channel) values (new.id, new.owner_id, 'telegram') on conflict do nothing;
  end if;
  if exists (select 1 from public.email_notification_preferences where owner_id = new.owner_id and ((new.type = 'incident_opened' and incident_open_enabled) or (new.type = 'incident_resolved' and incident_recovery_enabled))) then
    insert into public.notification_deliveries (notification_id, owner_id, channel) values (new.id, new.owner_id, 'email') on conflict do nothing;
  end if;
  return new;
exception when others then raise warning 'StackPulse delivery enqueue failed.'; return new;
end;
$function$;
