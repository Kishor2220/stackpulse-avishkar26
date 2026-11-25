# StackPulse controlled demo service

This isolated service supplies real, controllable HTTP responses for the
hackathon demo. It never writes StackPulse data; the worker performs normal
checks and persists the results.

## Run

```powershell
cd demo
npm install
Copy-Item .env.example .env
# Set a long, random DEMO_CONTROL_TOKEN in .env
npm start
```

The monitor target is `GET /health`. Controls are `POST /control` and require
an `Authorization: Bearer <DEMO_CONTROL_TOKEN>` header; no query-string token
is accepted.

```powershell
$headers = @{ Authorization = 'Bearer REPLACE_WITH_CONTROL_TOKEN' }
Invoke-RestMethod http://127.0.0.1:4010/control -Method Post -Headers $headers -ContentType 'application/json' -Body '{"mode":"failure"}'
Invoke-RestMethod http://127.0.0.1:4010/control -Method Post -Headers $headers -ContentType 'application/json' -Body '{"mode":"healthy"}'
Invoke-RestMethod http://127.0.0.1:4010/control -Method Post -Headers $headers -ContentType 'application/json' -Body '{"mode":"slow"}'
```

The worker intentionally rejects localhost and private targets. For a worker
running outside this machine, expose only `/health` through an authenticated,
reviewed HTTPS tunnel or deployment with a public DNS name, then use that
public URL when creating the monitor. Keep `/control` protected by the bearer
token and never add a StackPulse SSRF exception for this demo.
