# StackPulse

StackPulse is an AVISHKAR'26 uptime-monitoring prototype: authenticated users
manage HTTP(S) monitors in a Next.js dashboard, while a separate Node.js worker
records real checks, TLS expiry, incidents, and worker heartbeats in Supabase.

## Verified components

- Email/password authentication and a protected dashboard.
- Owner-scoped monitor create, edit, pause, publish, and delete flows.
- A separate worker that performs real HTTP(S) checks, records latency/status,
  pins validated public DNS addresses, does not follow redirects, and records
  TLS expiry when available.
- Three consecutive failures open one incident; a later successful check
  resolves it. Notification output is deliberately simulated in worker logs.
- Private dashboard readings, incident history, and TrustPulse heartbeat and
  coverage indicators from persisted data.
- A read-only public `/status` page for explicitly published monitors.

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for what is
verified locally, what requires Supabase configuration, and known limits.

## Required configuration

Create `web/.env.local` with these variable names (do not put a service-role
key here):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Create `worker/.env` from `worker/.env.example`:

```env
WORKER_SUPABASE_URL=
WORKER_SUPABASE_SERVICE_ROLE_KEY=
WORKER_ID=
WORKER_TIMEOUT_MS=10000
WORKER_MAX_RESPONSE_BYTES=1048576
WORKER_DATABASE_RETRY_ATTEMPTS=3
WORKER_DATABASE_RETRY_BASE_MS=200
```

Apply, in order, the reviewed migrations in `supabase/migrations/`:
`001_initial_schema.sql`, `002_public_status.sql`, then
`003_trustpulse_health.sql`, then `004_notifications.sql`. Migrations are
never executed automatically.

## Run locally

In separate terminals:

```powershell
cd web
npm install
npm run dev
```

```powershell
cd worker
npm install
npm run check
npm test
npm start
```

Open `http://localhost:3000`, register or log in, and create a public HTTP(S)
endpoint that resolves to a public IP address. Visit `/status` to see only
monitors intentionally marked public.

## Controlled demo

The isolated [demo service](demo/README.md) returns real healthy, failing, and
slow responses. Its control endpoint requires a bearer token and remains
separate from StackPulse. A remotely hosted worker must monitor a public HTTPS
deployment or reviewed tunnel URL; do not add a localhost exception.

```mermaid
flowchart LR
  Browser[Dashboard / public status] -->|publishable Supabase key + RLS| DB[(Supabase)]
  Worker[Trusted Node worker] -->|service-role key| DB
  Worker -->|pinned public HTTP(S)| Endpoint[Monitored endpoint]
  Demo[Controlled demo service] --> Endpoint
  Watchdog[Independent watchdog] -->|private heartbeat query| DB
  Watchdog -->|optional operator webhook| Operator[Operator alert endpoint]
```

## 24/7 deployment guidance

Deploy the frontend, worker, and watchdog as separate processes. The worker
needs persistent execution, automatic process restart, retained structured
logs, and server-only environment variables; a serverless Next.js host alone
cannot run continuous checks. Run the watchdog in a separate host/region and
network path where possible, with an operator-owned webhook outside the
worker's failure domain. It reports unavailable database telemetry as unknown,
not healthy.

```powershell
cd watchdog
npm install
npm run check
npm test
npm start
```

Use your platform's restart-on-failure policy, limit restart storms with
backoff, retain logs long enough for incident review, and monitor disk/network
resource exhaustion. StackPulse does not promise 100% availability and is
single-location monitoring unless additional worker regions are deployed.

## Verification commands

```powershell
cd web; npm run lint; npm run build
cd worker; npm test; npm run check
cd watchdog; npm test; npm run check
git diff --check
```
