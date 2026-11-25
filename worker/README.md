# StackPulse monitoring worker

This is a separate server-side Node.js process. It is the only StackPulse
component that uses `WORKER_SUPABASE_SERVICE_ROLE_KEY`; do not copy that value
to `web/.env.local`, browser code, logs, or CI output.

## Setup

1. Apply the reviewed Supabase migration so `monitors`, `monitor_checks`, and
   `worker_heartbeats` exist.
2. Copy `.env.example` to `.env` and fill in the Supabase project URL, service
   role key, and a stable worker identifier.
3. Run `npm install`, `npm run check`, and `npm test` from `worker/`.
4. Start only in a trusted server environment with `npm start` when ready.

The scheduler reloads active monitors every 15 seconds, evaluates due checks
every second, honors the configured 30/60/120-second interval, and prevents
overlapping checks for a monitor. It writes a heartbeat at startup and then
every minute.

## Security model and current limits

Each check resolves DNS immediately before connection, rejects local/internal
hostnames and private/reserved addresses, and creates a one-off connection
pinned to a validated public IP. HTTPS retains the original hostname for SNI
and certificate verification. Redirects are not followed because the worker
uses Node's native HTTP(S) client directly.

This is a hackathon-grade baseline. A production worker should add outbound
network egress controls, per-project quotas, retry/backoff policies, distributed
locking for multiple worker instances, observability, and an independent policy
for all newly introduced destination types.
