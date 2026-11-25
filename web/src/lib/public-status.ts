import { calculateHealth, type HealthCheck } from "./monitor-health";

export type PublicIncident = { status: "open" | "resolved"; opened_at: string; resolved_at: string | null };
export type PublicMonitor = {
  name: string;
  check_interval_seconds: number;
  latest_check: HealthCheck | null;
  checks_24h: HealthCheck[];
  incidents: PublicIncident[];
};

export function parsePublicStatus(value: unknown): PublicMonitor[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PublicMonitor => Boolean(item && typeof item === "object" && "name" in item && "check_interval_seconds" in item && "checks_24h" in item && "incidents" in item));
}

export function publicMonitorHealth(monitor: PublicMonitor, observedAt: string) {
  return calculateHealth(monitor.check_interval_seconds, monitor.latest_check, monitor.checks_24h, observedAt);
}

export type HourlyStatus = "up" | "down" | "missing";

export function hourlyStatusBars(checks: HealthCheck[], observedAt: string): { label: string; state: HourlyStatus }[] {
  const end = Date.parse(observedAt);
  return Array.from({ length: 24 }, (_, index) => {
    const start = end - (24 - index) * 60 * 60 * 1_000;
    const finish = start + 60 * 60 * 1_000;
    const latest = checks.filter((check) => {
      const time = Date.parse(check.checked_at);
      return time >= start && time < finish;
    }).sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0];
    return { label: new Date(start).toISOString().slice(11, 13), state: latest ? (latest.is_success ? "up" : "down") : "missing" };
  });
}
