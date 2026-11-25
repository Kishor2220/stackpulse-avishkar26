-- Lease and provider-acceptance metadata for the email dispatcher. Run after 006.
alter table public.notification_deliveries
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists provider_message_id text;

create index if not exists notification_deliveries_email_lease_idx
  on public.notification_deliveries (channel, status, next_attempt_at, lease_expires_at)
  where channel = 'email';
