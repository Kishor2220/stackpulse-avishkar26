export type MonitorCheck = {
  id: string;
  monitor_id: string;
  checked_at: string;
  http_status: number | null;
  response_latency_ms: number | null;
  is_success: boolean;
  tls_expires_at: string | null;
};

export type DashboardMonitor = {
  id: string;
  name: string;
  url: string;
  expected_http_status: number;
  check_interval_seconds: number;
  is_active: boolean;
  is_public: boolean;
  latestCheck: MonitorCheck | null;
  checks24h: MonitorCheck[];
};

export type MonitorHealth = {
  state: "up" | "down" | "stale" | "no-data";
  uptimePercent: number | null;
  successfulChecks: number;
  totalChecks: number;
  isFresh: boolean;
};

export type HealthCheck = Pick<MonitorCheck, "checked_at" | "is_success">;

export function calculateHealth(checkIntervalSeconds: number, latest: HealthCheck | null, checks24h: HealthCheck[], observedAt: string): MonitorHealth {
  const totalChecks = checks24h.length;
  const successfulChecks = checks24h.filter((check) => check.is_success).length;
  const uptimePercent = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : null;

  if (!latest) return { state: "no-data", uptimePercent, successfulChecks, totalChecks, isFresh: false };

  const ageMs = Date.parse(observedAt) - Date.parse(latest.checked_at);
  // A second missed interval is considered stale rather than current downtime.
  const isFresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= checkIntervalSeconds * 2_000;
  if (!isFresh) return { state: "stale", uptimePercent, successfulChecks, totalChecks, isFresh: false };

  return {
    state: latest.is_success ? "up" : "down",
    uptimePercent,
    successfulChecks,
    totalChecks,
    isFresh: true,
  };
}

export function calculateMonitorHealth(monitor: DashboardMonitor, observedAt: string): MonitorHealth {
  return calculateHealth(monitor.check_interval_seconds, monitor.latestCheck, monitor.checks24h, observedAt);
}

export function formatTimestamp(value: string | null) {
  if (!value) return "No check recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown time" : parsed.toISOString().replace("T", " ").replace(".000Z", " UTC");
}
