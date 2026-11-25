# StackPulse implementation status

This document records current code and test evidence; it is not a claim that
unconfigured external services have been exercised.

## Core workflow

| Requirement | Status | Evidence / limitation |
| --- | --- | --- |
| Register, log in, log out, protected dashboard | PASS (code/build) | Supabase Auth must be configured. |
| Owner-scoped monitor CRUD | PASS (code/build) | RLS policies are in migration 001. |
| Real HTTP(S) check persistence | BLOCKED externally | Worker code is implemented; requires reviewed migrations and worker credentials. |
| Safe URL/DNS validation | PASS (unit test) | Private/internal targets and redirect following are blocked. |
| Incident open/recovery | PASS (unit test) | Three consecutive process-observed failures; no restart backfill. |
| Public `/status` data separation | PASS (code/build) | Requires migration 002; intentionally no org-specific slug yet. |
| TrustPulse heartbeat and coverage | PASS (code/build) | Requires migration 003 and a running worker. |
| In-app notification history | IMPLEMENTED, BLOCKED externally | Migration 004 adds owner-scoped persisted events; must be applied to verify live. |
| Bounded database retry/backoff | PASS (unit test) | Three attempts by default for worker Supabase operations. |
| Missed-schedule detection | PASS (unit test) | Worker warns about delayed slots; it never fabricates check results. |
| Independent watchdog | IMPLEMENTED, locally tested | Deploy `watchdog/` outside the worker/frontend/Supabase-path failure domain. |
| Organizations, memberships, RBAC | FAIL | Current isolation is per authenticated monitor owner. |
| Failure retry between scheduled checks | FAIL | Current verification is three consecutive scheduled failures. |
| Controlled demo service | IMPLEMENTED, locally type-checked | `demo/` has token-protected controls; public tunnel/deployment and worker integration remain unverified. |

## Monitoring semantics

- A monitor is **Up** only when its latest successful check is no older than
  two configured check intervals.
- A fresh failed check is **Down**. Missing data is **No data yet**; old data is
  **Unknown / stale**.
- The worker writes a heartbeat at startup and then every 60 seconds.
  TrustPulse is Healthy through 60 seconds, Delayed through 180 seconds, and
  Offline thereafter. It never infers worker health from old monitor results.
- Coverage is fresh active monitors divided by active monitors. Unobserved
  periods are not uptime.
- Database unavailability is retried with bounded exponential backoff. If all
  attempts fail, the worker logs the failure and no successful result is added.
- A schedule delay beyond 1.5 monitor intervals is logged as missed; it does
  not convert the missing observation into a success or failure result.

## Security model

- Browser users use Supabase's publishable key only. The service-role key is
  confined to `worker/.env`.
- RLS scopes monitors, checks, and incidents to their owner. Heartbeat rows
  have no browser table grants or policies.
- The authenticated `get_trustpulse_health()` RPC returns only aggregate
  user-scoped coverage and a latest heartbeat timestamp, with empty search
  path. The public status RPC returns only deliberately published fields.
- The worker resolves and validates destinations for every connection, pins a
  validated public IP, preserves HTTPS hostname verification, limits response
  size/time, and disables redirects.
- The watchdog uses a separate server-only Supabase credential. It should run
  in a distinct failure domain; otherwise it is not an independent signal.

## Hackathon demonstration

1. Apply migrations 001 through 004 after review; configure web and worker
   environment files.
2. Run the web app and worker in separate terminals. Register and create a
   public monitor for an endpoint you control.
3. Wait for real check records. Show dashboard status, latency, uptime, TLS,
   coverage, `/status`, and TrustPulse Healthy state.
4. Make the controlled endpoint fail for at least three scheduled checks;
   show the actual open incident, persisted in-app notification, and simulated notification log.
5. Restore it; show the next successful check resolves the incident.
6. Stop the worker with Ctrl+C. After more than three minutes, refresh the
   dashboard to show TrustPulse Offline and monitor checks becoming stale.
7. Restart the worker; its startup heartbeat restores TrustPulse once the
   dashboard refreshes, and subsequent real checks restore monitor evidence.
8. Stop the worker again and verify the separately hosted watchdog emits a
   stale-heartbeat operator alert after its configured expiry window.

## Current limitations

- The product is owner-based, not organization/RBAC based.
- Status pages use the single `/status` aggregation route, not per-company
  slugs.
- Email/webhook alerts remain simulated logs. In-app notifications require
  migration 004 and are shown on the dashboard once applied.
- Multi-worker coordination and durable distributed locking are not present.
- Single-location checks cannot distinguish a local routing issue from a
  global outage; deploy independent worker locations for stronger confidence.
- Supabase integration and the live end-to-end journey require a configured
  project; no fabricated records are inserted for verification.
