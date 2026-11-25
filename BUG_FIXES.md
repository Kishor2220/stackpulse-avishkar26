# StackPulse bug fixes

| ID | Defect | Fix | Regression evidence |
| --- | --- | --- | --- |
| BUG-001 | Latency chart filtered missing observations then connected distant points | Chart now retains all observations and uses `connectNulls={false}` | Frontend build; manual chart semantics review |
| BUG-002 | Failed measured HTTP responses were visually indistinguishable from successful ones | Green success and red failure scatter markers plus outcome tooltip | Frontend build |
| BUG-003 | Worker database operations failed immediately during transient outages | Bounded retry/backoff utility applied to worker Supabase operations | Worker retry tests |
| BUG-004 | Missed schedules had no operator signal | Scheduler logs delayed slots without fabricating a result | Scheduler test |
| BUG-005 | Worker shutdown could abandon lifecycle visibility | Scheduler waits for started checks after SIGINT/SIGTERM | Scheduler idle test |

No live database defect was changed without a reviewed incremental migration.
