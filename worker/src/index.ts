import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { checkEndpoint, checkLogLine } from "./checker.js";
import { loadConfig } from "./config.js";
import { IncidentManager, SimulatedIncidentNotifier } from "./incident-manager.js";
import { createSupabaseIncidentRepository } from "./incident-repository.js";
import { MonitorScheduler, type ActiveMonitor } from "./scheduler.js";

export const HEARTBEAT_INTERVAL_SECONDS = 60;
export const HEARTBEAT_CRON = "0 * * * * *";

async function main() {
  const config = loadConfig();
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const incidents = new IncidentManager(
    createSupabaseIncidentRepository(supabase),
    new SimulatedIncidentNotifier(),
  );

  async function loadActiveMonitors(): Promise<ActiveMonitor[]> {
    const { data, error } = await supabase.from("monitors")
      .select("id, name, url, expected_http_status, check_interval_seconds")
      .eq("is_active", true);
    if (error) throw new Error("Could not load active monitors.");
    return (data ?? []) as ActiveMonitor[];
  }

  async function recordHeartbeat() {
    const now = new Date().toISOString();
    const { error } = await supabase.from("worker_heartbeats").upsert({
      worker_identifier: config.workerId,
      last_heartbeat_at: now,
      updated_at: now,
    }, { onConflict: "worker_identifier" });
    if (error) throw new Error("Could not record worker heartbeat.");
    console.info(`[heartbeat] ${config.workerId} recorded`);
  }

  async function checkMonitor(monitor: ActiveMonitor) {
    const result = await checkEndpoint(monitor.url, monitor.expected_http_status, {
      timeoutMs: config.timeoutMs,
      maxResponseBytes: config.maxResponseBytes,
    });
    const { error } = await supabase.from("monitor_checks").insert({
      monitor_id: monitor.id,
      http_status: result.httpStatus,
      response_latency_ms: result.responseLatencyMs,
      is_success: result.isSuccess,
      tls_expires_at: result.tlsExpiresAt,
      error_details: result.errorDetails,
    });
    if (error) throw new Error("Could not record monitor check.");
    console.info(checkLogLine(monitor.id, monitor.url, result));
    await incidents.observe(monitor.id, result);
  }

  const scheduler = new MonitorScheduler({ loadActiveMonitors, checkMonitor });
  const guardedTick = async () => {
    try {
      await scheduler.tick();
    } catch (error) {
      console.error("[worker] scheduling error:", error instanceof Error ? error.message : "Unknown error");
    }
  };
  const guardedHeartbeat = async () => {
    try {
      await recordHeartbeat();
    } catch (error) {
      console.error("[worker] heartbeat error:", error instanceof Error ? error.message : "Unknown error");
    }
  };

  await guardedHeartbeat();
  await guardedTick();
  cron.schedule("* * * * * *", () => void guardedTick());
  cron.schedule(HEARTBEAT_CRON, () => void guardedHeartbeat());
  console.info(`[worker] ${config.workerId} started; heartbeats run every ${HEARTBEAT_INTERVAL_SECONDS}s; checks use pinned public IP connections and no redirects.`);
}

main().catch((error) => {
  console.error("[worker] configuration error:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
