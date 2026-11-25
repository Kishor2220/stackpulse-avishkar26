import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { checkEndpoint, checkLogLine } from "./checker.js";
import { loadConfig } from "./config.js";
import { IncidentManager, SimulatedIncidentNotifier } from "./incident-manager.js";
import { createSupabaseIncidentRepository } from "./incident-repository.js";
import { MonitorScheduler, type ActiveMonitor } from "./scheduler.js";
import { withRetry } from "./retry.js";
import { EmailDispatcher } from "./email-dispatcher.js";
import { ResendEmailProvider } from "./email-provider.js";
import { createSupabaseEmailDeliveryRepository } from "./supabase-email-delivery-repository.js";

export const HEARTBEAT_INTERVAL_SECONDS = 60;
export const HEARTBEAT_CRON = "0 * * * * *";

async function main() {
  const config = loadConfig();
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const retryDatabase = <T>(operation: () => Promise<T>) => withRetry(operation, {
    attempts: config.databaseRetryAttempts,
    baseDelayMs: config.databaseRetryBaseMs,
  });
  const incidents = new IncidentManager(
    createSupabaseIncidentRepository(supabase, retryDatabase),
    new SimulatedIncidentNotifier(),
  );
  const emailDispatcher = config.resendApiKey && config.resendFromEmail ? new EmailDispatcher(createSupabaseEmailDeliveryRepository(supabase), new ResendEmailProvider(config.resendApiKey, config.resendFromEmail), config.workerId) : null;

  async function loadActiveMonitors(): Promise<ActiveMonitor[]> {
    return retryDatabase(async () => {
      const { data, error } = await supabase.from("monitors")
        .select("id, name, url, expected_http_status, check_interval_seconds")
        .eq("is_active", true);
      if (error) throw new Error("Could not load active monitors.");
      return (data ?? []) as ActiveMonitor[];
    });
  }

  async function recordHeartbeat() {
    const now = new Date().toISOString();
    await retryDatabase(async () => {
      const { error } = await supabase.from("worker_heartbeats").upsert({
        worker_identifier: config.workerId,
        last_heartbeat_at: now,
        updated_at: now,
      }, { onConflict: "worker_identifier" });
      if (error) throw new Error("Could not record worker heartbeat.");
    });
    console.info(`[heartbeat] ${config.workerId} recorded`);
  }

  async function checkMonitor(monitor: ActiveMonitor) {
    const result = await checkEndpoint(monitor.url, monitor.expected_http_status, {
      timeoutMs: config.timeoutMs,
      maxResponseBytes: config.maxResponseBytes,
    });
    await retryDatabase(async () => {
      const { error } = await supabase.from("monitor_checks").insert({
        monitor_id: monitor.id,
        http_status: result.httpStatus,
        response_latency_ms: result.responseLatencyMs,
        is_success: result.isSuccess,
        tls_expires_at: result.tlsExpiresAt,
        error_details: result.errorDetails,
      });
      if (error) throw new Error("Could not record monitor check.");
    });
    console.info(checkLogLine(monitor.id, monitor.url, result));
    await incidents.observe(monitor.id, result);
  }

  const scheduler = new MonitorScheduler({
    loadActiveMonitors,
    checkMonitor,
    onMissedSchedule(monitor, delayMs) {
      console.warn(`[worker] delayed schedule for ${monitor.id}: ${delayMs}ms late; no result was inferred.`);
    },
  });
  const guardedTick = async () => {
    if (shuttingDown) return;
    try {
      await scheduler.tick();
    } catch (error) {
      console.error("[worker] scheduling error:", error instanceof Error ? error.message : "Unknown error");
    }
  };
  const guardedHeartbeat = async () => {
    if (shuttingDown) return;
    try {
      await recordHeartbeat();
    } catch (error) {
      console.error("[worker] heartbeat error:", error instanceof Error ? error.message : "Unknown error");
    }
  };
  let emailPolling = false;
  const guardedEmailPoll = async () => {
    if (!emailDispatcher || shuttingDown || emailPolling) return;
    emailPolling = true;
    try { while (await emailDispatcher.processOne()) undefined; } catch { console.error("[worker] email dispatcher error."); } finally { emailPolling = false; }
  };

  let shuttingDown = false;
  await guardedHeartbeat();
  await guardedTick();
  const checkTask = cron.schedule("* * * * * *", () => void guardedTick());
  const heartbeatTask = cron.schedule(HEARTBEAT_CRON, () => void guardedHeartbeat());
  const emailTimer = emailDispatcher ? setInterval(() => void guardedEmailPoll(), config.emailPollMs) : null;
  if (emailDispatcher) void guardedEmailPoll();

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    checkTask.stop();
    heartbeatTask.stop();
    if (emailTimer) clearInterval(emailTimer);
    console.info(`[worker] ${signal} received; waiting for active checks to finish.`);
    await scheduler.waitForIdle();
    while (emailPolling) await new Promise((resolve) => setTimeout(resolve, 25));
    console.info("[worker] stopped cleanly.");
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  console.info(`[worker] ${config.workerId} started; heartbeats run every ${HEARTBEAT_INTERVAL_SECONDS}s; checks use pinned public IP connections and no redirects.`);
}

main().catch((error) => {
  console.error("[worker] configuration error:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
