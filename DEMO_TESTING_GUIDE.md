# StackPulse controlled demo guide

1. Review and apply migrations `001` through `005` in a disposable Supabase project.
2. Configure web and worker environments; start the web app and worker.
3. Run `demo/` with a long `DEMO_CONTROL_TOKEN`.
4. Deploy or tunnel the demo health endpoint over public HTTPS. Do not create a
   localhost/private-IP exception in the worker.
5. Create a monitor for `/health`, expected status 200, and wait for actual
   persisted observations.
6. Send an authenticated control request selecting `failure`; wait for three
   scheduled real failures, then show the incident and in-app notification.
7. Select `healthy`; wait for the next real success and show resolution.
8. Select `slow` with delay greater than the worker timeout to demonstrate a
   timeout. This is an availability failure, not fabricated latency.
9. Stop worker, wait past heartbeat freshness, and show TrustPulse Offline and
   stale monitor evidence. Restart it to show fresh heartbeat/check recovery.

Telegram delivery is excluded until a bot dispatcher and controlled credentials
are configured; do not claim a simulated log is a phone notification.
