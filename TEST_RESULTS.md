# StackPulse test results

## Baseline and local verification

| Test group | Result | Evidence |
| --- | --- | --- |
| Worker unit tests | PASS: 17 tests | Includes status matching, DNS/IP protections, incidents, retries, and scheduling. |
| Worker TypeScript | PASS | `worker/npm run check` |
| Watchdog unit tests | PASS: 2 tests | Deterministic heartbeat classification. |
| Demo TypeScript | Previously PASS | `demo/npm run check` from the prior local verification pass. |
| Frontend lint | PASS | `web/npm run lint` completed with exit code 0. |
| Frontend build | PASS | Retry succeeded after Next's transient build lock released. |
| Diff whitespace | Pending final run | `git diff --check` |

## Blocked integration tests

- RLS, RPC permissions, trigger-created notification rows, and public/private
  separation require a disposable Supabase project with migrations applied.
- Telegram provider acceptance, retry, and linking require a configured test
  bot token and a controlled chat account.
- A remote worker cannot safely monitor the localhost demo service; it needs a
  reviewed public HTTPS deployment/tunnel.

## Not implemented

- Telegram dispatcher/lease implementation and provider retry handling.
- Configurable latency threshold/degraded performance classification.
- Browser automation, load/stress measurements, and multi-worker locking.
