# StackPulse security report

## Verified controls

- Worker validation rejects private, loopback, link-local, reserved, and mixed
  public/private DNS destinations; connections are pinned to a validated IP.
- HTTPS preserves hostname verification; redirects are disabled; request and
  response-size limits are enforced.
- Browser clients use publishable Supabase credentials only. Worker/watchdog
  service-role credentials remain server-side environment variables.
- Existing migrations enable RLS for private monitoring records. Public and
  TrustPulse access use scoped security-definer functions with empty search
  paths.
- Notification and Telegram-outbox migrations are owner-scoped and use unique
  keys for idempotency.

## Remaining risks

- RLS and SQL functions are not live-tested until migrations run in a disposable
  Supabase project.
- Telegram queue schema exists, but no dispatcher/link-consumer is implemented.
- Multiple workers can duplicate checks; the database partial unique index only
  prevents duplicate open incidents.
- A watchdog is independent only when deployed outside the worker/frontend and
  database-network failure domain.
