-- Fix exact RETURN QUERY type matching for the email claim RPC. Run after the
-- applicable email delivery migration; preserves queue rows and leases.
create or replace function public.claim_email_delivery(p_worker_id text, p_lease_seconds integer default 60)
returns table (
  id uuid,
  notification_id uuid,
  owner_id uuid,
  attempt_count integer,
  recipient text,
  subject text,
  body_text text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  with candidate as (
    select d.id
    from public.notification_deliveries d
    join public.notifications n on n.id = d.notification_id
    join public.email_notification_preferences p on p.owner_id = d.owner_id
    join auth.users u on u.id = d.owner_id
    where d.channel = 'email'
      and ((d.status = 'pending' and d.next_attempt_at <= now()) or (d.status = 'processing' and d.lease_expires_at < now()))
      and ((n.type = 'incident_opened' and p.incident_open_enabled) or (n.type = 'incident_resolved' and p.incident_recovery_enabled))
      and u.email is not null
    order by d.next_attempt_at, d.created_at
    for update of d skip locked
    limit 1
  ), claimed as (
    update public.notification_deliveries d
    set status = 'processing',
        lease_owner = p_worker_id,
        lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 1)),
        last_attempt_at = now()
    from candidate
    where d.id = candidate.id
    returning d.*
  )
  select
    d.id::uuid,
    d.notification_id::uuid,
    d.owner_id::uuid,
    d.attempt_count::integer,
    u.email::text,
    (case when n.type = 'incident_opened' then '[StackPulse CRITICAL] ' else '[StackPulse RECOVERY] ' end || n.title)::text,
    n.body::text
  from claimed d
  join public.notifications n on n.id = d.notification_id
  join auth.users u on u.id = d.owner_id;
end;
$function$;

revoke all on function public.claim_email_delivery(text, integer) from public;
revoke all on function public.claim_email_delivery(text, integer) from anon, authenticated;
grant execute on function public.claim_email_delivery(text, integer) to service_role;
