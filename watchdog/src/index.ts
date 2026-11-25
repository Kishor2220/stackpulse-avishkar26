import "dotenv/config";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { classifyHeartbeat, type WatchdogState } from "./health.js";

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

const url = process.env.WATCHDOG_SUPABASE_URL;
const serviceRoleKey = process.env.WATCHDOG_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Missing WATCHDOG_SUPABASE_URL or WATCHDOG_SUPABASE_SERVICE_ROLE_KEY.");

const staleAfterSeconds = positiveInteger(process.env.WATCHDOG_HEARTBEAT_STALE_SECONDS, 180, "WATCHDOG_HEARTBEAT_STALE_SECONDS");
const webhookUrl = process.env.WATCHDOG_ALERT_WEBHOOK_URL;
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
let lastState: WatchdogState | null = null;

async function alert(state: WatchdogState, lastHeartbeatAt: string | null) {
  const event = { type: "STACKPULSE_WATCHDOG_ALERT", state, lastHeartbeatAt, occurredAt: new Date().toISOString() };
  console.warn(JSON.stringify(event));
  if (!webhookUrl) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event), signal: controller.signal });
    if (!response.ok) console.error(`[watchdog] alert webhook failed with HTTP ${response.status}.`);
  } catch {
    console.error("[watchdog] alert webhook could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

async function inspect() {
  const { data, error } = await supabase.from("worker_heartbeats")
    .select("last_heartbeat_at")
    .order("last_heartbeat_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const state = error ? "unknown" : classifyHeartbeat(data?.last_heartbeat_at ?? null, new Date().toISOString(), staleAfterSeconds);
  if (state !== lastState) {
    if (state !== "healthy") await alert(state, data?.last_heartbeat_at ?? null);
    else console.info("[watchdog] worker heartbeat recovered.");
    lastState = state;
  }
}

async function main() {
  await inspect();
  const task = cron.schedule("0 * * * * *", () => void inspect());
  const shutdown = (signal: string) => {
    task.stop();
    console.info(`[watchdog] ${signal} received; stopped.`);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  console.info(`[watchdog] started; heartbeat expiry is ${staleAfterSeconds}s.`);
}

main().catch((error) => {
  console.error("[watchdog] configuration error:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
