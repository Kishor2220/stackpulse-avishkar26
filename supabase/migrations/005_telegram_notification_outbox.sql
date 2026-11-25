-- Telegram linking and durable notification delivery queue. Run after 004.
-- Browser roles never receive Telegram bot credentials or direct write access
-- to connections/deliveries. A trusted dispatcher consumes this queue.

create table public.telegram_link_tokens (
  token uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index telegram_link_tokens_owner_idx on public.telegram_link_tokens (owner_id, expires_at desc);

create table public.telegram_connections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint not null unique,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('telegram')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error_category text,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_pending_idx on public.notification_deliveries (status, next_attempt_at)
  where status in ('pending', 'processing');

alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_connections enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.telegram_link_tokens, public.telegram_connections, public.notification_deliveries from anon;
revoke all on public.telegram_link_tokens, public.telegram_connections, public.notification_deliveries from authenticated;
grant select, insert on public.telegram_link_tokens to authenticated;
grant select on public.telegram_connections, public.notification_deliveries to authenticated;
create policy "Users can create and view own Telegram link tokens" on public.telegram_link_tokens
  for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Users can view own Telegram connection" on public.telegram_connections
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Users can view own notification deliveries" on public.notification_deliveries
  for select to authenticated using ((select auth.uid()) = owner_id);

-- Queue only after a bot-mediated account link. Unique event/channel keys make
-- repeated incident processing idempotent; queue failures do not alter incidents.
create or replace function public.enqueue_telegram_delivery()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if exists (select 1 from public.telegram_connections where owner_id = new.owner_id) then
    insert into public.notification_deliveries (notification_id, owner_id, channel)
    values (new.id, new.owner_id, 'telegram') on conflict (notification_id, channel) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'StackPulse Telegram delivery enqueue failed.';
  return new;
end;
$function$;
revoke all on function public.enqueue_telegram_delivery() from public;
create trigger notification_telegram_delivery_after_insert
after insert on public.notifications for each row execute function public.enqueue_telegram_delivery();
