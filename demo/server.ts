import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

type DemoMode = "healthy" | "failure" | "slow";

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

const token = process.env.DEMO_CONTROL_TOKEN;
if (!token) throw new Error("Missing DEMO_CONTROL_TOKEN. Refusing to expose unauthenticated demo controls.");

const port = positiveInteger(process.env.DEMO_PORT, 4010, "DEMO_PORT");
const slowDelayMs = positiveInteger(process.env.DEMO_SLOW_DELAY_MS, 12_000, "DEMO_SLOW_DELAY_MS");
let mode: DemoMode = "healthy";

function send(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function hasControlToken(request: IncomingMessage) {
  const value = request.headers.authorization;
  const expected = `Bearer ${token}`;
  if (!value || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

async function body(request: IncomingMessage) {
  let payload = "";
  for await (const chunk of request) {
    payload += chunk;
    if (payload.length > 1_024) throw new Error("Payload too large.");
  }
  return JSON.parse(payload || "{}") as { mode?: unknown };
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  if (request.method === "GET" && path === "/health") {
    if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, slowDelayMs));
    const status = mode === "failure" ? 503 : 200;
    send(response, status, { status: mode === "failure" ? "unavailable" : "ok" });
    return;
  }

  if (request.method === "POST" && path === "/control") {
    if (!hasControlToken(request)) {
      send(response, 401, { error: "Unauthorized." });
      return;
    }
    try {
      const payload = await body(request);
      if (payload.mode !== "healthy" && payload.mode !== "failure" && payload.mode !== "slow") {
        send(response, 400, { error: "mode must be healthy, failure, or slow." });
        return;
      }
      mode = payload.mode;
      send(response, 200, { mode });
    } catch {
      send(response, 400, { error: "Invalid control request." });
    }
    return;
  }

  send(response, 404, { error: "Not found." });
});

server.listen(port, "127.0.0.1", () => {
  console.info(`[demo] listening on http://127.0.0.1:${port}/health`);
});
