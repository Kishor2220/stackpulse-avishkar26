import type { MonitorCheck } from "./monitor-health";

export type LatencyPoint = { timestamp: string; time: string; latency: number | null; outcome: "success" | "failure"; httpStatus: number | null; failureCategory: string | null };

export function latencyChartData(checks: MonitorCheck[]): LatencyPoint[] {
  return checks.slice().sort((a, b) => a.checked_at.localeCompare(b.checked_at)).map((check) => ({
    timestamp: check.checked_at,
    time: new Date(check.checked_at).toISOString().slice(11, 16),
    latency: check.response_latency_ms,
    outcome: check.is_success ? "success" : "failure",
    httpStatus: check.http_status,
    failureCategory: check.is_success ? null : check.http_status ? `HTTP ${check.http_status}` : "Network, DNS, or timeout failure",
  }));
}
