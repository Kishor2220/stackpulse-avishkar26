# StackPulse test plan

| ID | Feature | Scenario | Expected result | Priority | Mode | Status |
| --- | --- | --- | --- | --- | --- | --- |
| MON-001 | HTTP checks | Actual status equals expected status | Successful result | P0 | Automated | Planned |
| MON-004 | HTTP checks | 404 with expected 200 | Failed result; measured latency retained | P0 | Automated | Planned |
| MON-006 | Incidents | Three consecutive failures | One open incident | P0 | Automated | Implemented test |
| MON-007 | Timeouts | Request timeout | No fabricated HTTP status | P0 | Automated | Planned |
| MON-008 | DNS | Unsafe/mixed DNS result | Connection rejected | P0 | Automated | Implemented test |
| MON-013 | Scheduling | Paused/deleted monitor removed on refresh | No future scheduled check | P0 | Automated | Partial |
| INC-001 | Recovery | Success after open incident | One resolved incident | P0 | Automated | Implemented test |
| INC-002 | Concurrency | Competing opens | Partial unique index permits one open incident | P0 | Database integration | Blocked |
| NOT-001 | In-app | Open/resolved events | One owner-scoped notification per event | P0 | Database integration | Blocked |
| NOT-004 | Telegram | Provider acceptance | Delivery recorded only after API acceptance | P1 | Mock/integration | Not implemented |
| TP-001 | TrustPulse | Fresh/stale/absent heartbeat | Correct health state | P0 | Unit | Implemented test |
| TP-005 | Freshness | Worker stops after success | Current status becomes stale | P0 | Unit | Planned |
| SEC-001 | SSRF | Private, loopback, link-local, mixed DNS | Rejected before connection | P0 | Automated | Implemented test |
| SEC-002 | Auth/RLS | Cross-owner records | Denied | P0 | Supabase integration | Blocked |
| PUB-001 | Public status | Private monitor | Not returned by RPC | P0 | Supabase integration | Blocked |
| MET-001 | Charts | Missing latency/check evidence | Gap/grey evidence, never fake continuity | P0 | Build/manual | Implemented |
| DEMO-001 | Controlled demo | 200/503/slow/recovery | Real response changes | P1 | Local manual | Planned |

Only completed commands are marked passed in `TEST_RESULTS.md`.
