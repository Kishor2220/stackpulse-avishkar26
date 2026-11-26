# Email-only migration path

The committed migrations `005`–`008` are historical and must not be rewritten.
They contain Telegram objects. For the known Supabase database with only the
five tables from migrations `001`–`004`, review and apply
`009_email_only_delivery_baseline.sql` directly after `004`; do not run
`005`–`008` there.

Before choosing that path, run this read-only verification:

```sql
select to_regclass('public.telegram_link_tokens') as telegram_link_tokens,
       to_regclass('public.telegram_connections') as telegram_connections,
       to_regclass('public.notification_deliveries') as notification_deliveries,
       to_regclass('public.email_notification_preferences') as email_preferences;
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('enqueue_telegram_delivery', 'enqueue_email_delivery', 'claim_email_delivery');
```

If Telegram objects exist, do **not** run destructive cleanup automatically.
They may contain user data. Preserve the historical migrations and prepare a
separate, approved forward cleanup migration after confirming data retention
requirements. New developers using a migration runner must record `005`–`008`
as intentionally skipped/repaired for this email-only baseline; otherwise a
sequential runner will still create the old Telegram objects.
