export const WORKER_HEARTBEAT_INTERVAL_SECONDS = 60;
const DELAYED_AFTER_INTERVALS = 1;
const OFFLINE_AFTER_INTERVALS = 3;

export type TrustPulseState = "healthy" | "delayed" | "offline" | "unknown";

export type TrustPulseData = {
  last_heartbeat_at: string | null;
  heartbeat_interval_seconds: number;
  active_monitor_count: number;
  fresh_monitor_count: number;
};

export function parseTrustPulseData(value: unknown): TrustPulseData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const heartbeat = data.last_heartbeat_at;
  const interval = data.heartbeat_interval_seconds;
  const active = data.active_monitor_count;
  const fresh = data.fresh_monitor_count;
  if ((typeof heartbeat !== "string" && heartbeat !== null) || typeof interval !== "number" || typeof active !== "number" || typeof fresh !== "number") return null;
  if (!Number.isFinite(interval) || interval <= 0 || !Number.isInteger(active) || !Number.isInteger(fresh) || active < 0 || fresh < 0 || fresh > active) return null;
  return { last_heartbeat_at: heartbeat, heartbeat_interval_seconds: interval, active_monitor_count: active, fresh_monitor_count: fresh };
}

export function getTrustPulseState(lastHeartbeatAt: string | null, observedAt: string, heartbeatIntervalSeconds = WORKER_HEARTBEAT_INTERVAL_SECONDS): TrustPulseState {
  if (!lastHeartbeatAt || !Number.isFinite(heartbeatIntervalSeconds) || heartbeatIntervalSeconds <= 0) return "unknown";
  const ageMs = Date.parse(observedAt) - Date.parse(lastHeartbeatAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return "unknown";
  const ageSeconds = ageMs / 1_000;
  if (ageSeconds <= heartbeatIntervalSeconds * DELAYED_AFTER_INTERVALS) return "healthy";
  if (ageSeconds <= heartbeatIntervalSeconds * OFFLINE_AFTER_INTERVALS) return "delayed";
  return "offline";
}

export function heartbeatAgeLabel(lastHeartbeatAt: string | null, observedAt: string) {
  if (!lastHeartbeatAt) return "No heartbeat recorded";
  const ageMs = Date.parse(observedAt) - Date.parse(lastHeartbeatAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) return "Unknown";
  const seconds = Math.floor(ageMs / 1_000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes}m ago` : `${minutes}m ${remainingSeconds}s ago`;
}

export function coveragePercent(activeMonitorCount: number, freshMonitorCount: number) {
  return activeMonitorCount === 0 ? null : (freshMonitorCount / activeMonitorCount) * 100;
}
