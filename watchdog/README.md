# StackPulse watchdog

This is a small, separate operator-facing process that queries the most recent
private worker heartbeat once per minute. It logs and can POST a structured
alert when heartbeat evidence becomes stale or database telemetry is
unavailable.

## Important deployment boundary

It is **not independent** if it runs on the same host, process manager,
network, Supabase project access path, or cloud region as the worker. Deploy
it in a separate failure domain and configure `WATCHDOG_ALERT_WEBHOOK_URL` to
an operator-owned endpoint outside that domain. If Supabase cannot be reached,
the watchdog reports `unknown`, not a false healthy worker state.

## Setup

```powershell
cd watchdog
npm install
Copy-Item .env.example .env
npm run check
npm test
npm start
```

`WATCHDOG_SUPABASE_SERVICE_ROLE_KEY` is a server-only credential. Never place
it in the frontend environment or expose watchdog output publicly.
