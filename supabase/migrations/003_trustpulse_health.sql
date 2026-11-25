-- TrustPulse dashboard support. Run after 001_initial_schema.sql and
-- 002_public_status.sql. This does not grant browser roles any access to
-- worker_heartbeats or other monitoring tables.

-- Returns only the authenticated user's aggregate monitor coverage plus the
-- global worker's most recent heartbeat. The worker identifier itself is never
-- returned. The worker currently records a heartbeat once every 60 seconds.
create or replace function public.get_trustpulse_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with owned_active_monitors as (
    select id, check_interval_seconds
    from public.monitors
    where owner_id = auth.uid()
      and is_active = true
  ),
  latest_monitor_checks as (
    select monitor.id, monitor.check_interval_seconds, latest.checked_at
    from owned_active_monitors as monitor
    left join lateral (
      select checked_at
      from public.monitor_checks
      where monitor_id = monitor.id
      order by checked_at desc
      limit 1
    ) as latest on true
  ),
  latest_heartbeat as (
    select max(last_heartbeat_at) as last_heartbeat_at
    from public.worker_heartbeats
  )
  select jsonb_build_object(
    'last_heartbeat_at', (select last_heartbeat_at from latest_heartbeat),
    'heartbeat_interval_seconds', 60,
    'active_monitor_count', (select count(*) from owned_active_monitors),
    'fresh_monitor_count', (
      select count(*)
      from latest_monitor_checks
      where checked_at <= now()
        and checked_at >= now() - (check_interval_seconds * interval '2 seconds')
    )
  );
$function$;

-- Keep this the only browser-facing path to worker liveness. Existing table
-- grants/RLS policies remain unchanged; auth.uid() scopes monitor aggregates.
revoke all on function public.get_trustpulse_health() from public;
grant execute on function public.get_trustpulse_health() to authenticated;
