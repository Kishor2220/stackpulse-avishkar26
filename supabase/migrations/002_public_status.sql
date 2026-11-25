-- Public Status Page support. Run after 001_initial_schema.sql.
-- This migration does not weaken table RLS. Anonymous readers receive access
-- only to the tightly scoped function below, never to monitoring tables.

alter table public.monitors
  add column if not exists is_public boolean not null default false;

comment on column public.monitors.is_public is 'Whether this monitor may appear in the read-only public status page.';

create index if not exists monitors_public_idx
  on public.monitors (is_public)
  where is_public;

-- This SECURITY DEFINER function intentionally returns a minimal public view:
-- no owner IDs, endpoint URLs, raw HTTP errors, worker details, or private
-- monitor data. The function owner must remain a trusted database role.
create or replace function public.get_public_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', monitor.name,
        'check_interval_seconds', monitor.check_interval_seconds,
        'latest_check', (
          select jsonb_build_object(
            'checked_at', latest.checked_at,
            'is_success', latest.is_success
          )
          from public.monitor_checks as latest
          where latest.monitor_id = monitor.id
          order by latest.checked_at desc
          limit 1
        ),
        'checks_24h', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'checked_at', check_row.checked_at,
              'is_success', check_row.is_success
            ) order by check_row.checked_at asc
          )
          from public.monitor_checks as check_row
          where check_row.monitor_id = monitor.id
            and check_row.checked_at >= now() - interval '24 hours'
        ), '[]'::jsonb),
        'incidents', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'status', incident_row.status,
              'opened_at', incident_row.opened_at,
              'resolved_at', incident_row.resolved_at
            ) order by incident_row.opened_at desc
          )
          from (
            select status, opened_at, resolved_at
            from public.incidents
            where monitor_id = monitor.id
            order by opened_at desc
            limit 50
          ) as incident_row
        ), '[]'::jsonb)
      )
      order by monitor.name asc
    ),
    '[]'::jsonb
  )
  from public.monitors as monitor
  where monitor.is_public = true;
$function$;

revoke all on function public.get_public_status() from public;
grant execute on function public.get_public_status() to anon, authenticated;
