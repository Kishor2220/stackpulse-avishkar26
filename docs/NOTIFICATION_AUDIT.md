# Notification pipeline audit

## Verified local code path

1. The worker opens an incident only after three consecutive failed checks.
2. Migration `004_notifications.sql` installs an `AFTER INSERT OR UPDATE OF
   status` trigger on `public.incidents`.
3. The trigger creates one owner-scoped row in `public.notifications` for a new
   open incident and one for its later resolution. `unique (incident_id, type)`
   prevents duplicates.
4. The dashboard queries `notifications` by the authenticated `owner_id` and
   uses the RLS-protected mark-read action for unread state.

## Why historical incidents have no notification rows

PostgreSQL triggers do not replay against rows that already existed before the
trigger was created. StackPulse intentionally does not backfill notification
rows for old incidents, because that would create misleading historical alerts
and potentially duplicate user-visible events. A zero count for incidents that
predate migration `004` is therefore expected.

## Safe Supabase audit queries

Run these read-only queries in the Supabase SQL editor after reviewing them.
They do not insert, update, delete, or reapply migrations.

```sql
-- Confirm the table and trigger exist.
select to_regclass('public.notifications') as notifications_table;
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.incidents'::regclass
  and not tgisinternal;

-- Compare incident creation time to notification creation time.
select i.id, i.status, i.opened_at, i.resolved_at,
       n.type, n.created_at as notification_created_at
from public.incidents i
left join public.notifications n on n.incident_id = i.id
order by i.opened_at desc;

-- Confirm notification ownership matches the monitor owner.
select n.id, n.type, n.owner_id, m.owner_id as monitor_owner_id
from public.notifications n
join public.monitors m on m.id = n.monitor_id
where n.owner_id is distinct from m.owner_id;
```

The last query must return zero rows. If the trigger query returns no matching
trigger, migration `004` was only partially applied and must be reviewed before
being reapplied through the project's migration workflow.

## Controlled verification

Use a new monitor incident after migration `004` is present: produce three
real, controlled failed checks, then inspect for one `incident_opened` row.
Recover with a real successful check and inspect for one `incident_resolved`
row. Do not insert test notifications manually and do not backfill old rows.

## Email status

The repository contains a server-only Resend-compatible provider adapter and
an email-outbox migration (`006`), but no dispatcher currently claims queued
email rows or calls the provider. Email is therefore **not operational** and
must not be described as sent. A Resend API key, verified sender, dispatcher,
and authorized test recipient are still required.
