import type { CheckResult } from "./checker.js";

export type IncidentRecord = { id: string; openedAt: string; resolvedAt?: string | null };

export interface IncidentRepository {
  open(monitorId: string, reason: string): Promise<IncidentRecord | null>;
  resolve(monitorId: string): Promise<IncidentRecord | null>;
}

export interface IncidentNotifier {
  notify(event: "opened" | "resolved", monitorId: string, incident: IncidentRecord, reason?: string): void;
}

export class SimulatedIncidentNotifier implements IncidentNotifier {
  notify(event: "opened" | "resolved", monitorId: string, incident: IncidentRecord, reason?: string) {
    console.info(JSON.stringify({
      type: "SIMULATED_INCIDENT_NOTIFICATION",
      channels: ["email", "webhook"],
      event: `incident.${event}`,
      monitorId,
      incidentId: incident.id,
      reason: reason ?? null,
      occurredAt: event === "opened" ? incident.openedAt : incident.resolvedAt,
    }));
  }
}

function failureReason(result: CheckResult) {
  return result.errorDetails ?? "Monitor check failed without a response.";
}

// Failure counts intentionally live only for this worker process. A restart
// starts a fresh sequence and never creates incidents from historical rows.
export class IncidentManager {
  private readonly consecutiveFailures = new Map<string, number>();
  private readonly knownOpenIncidents = new Set<string>();

  constructor(private readonly repository: IncidentRepository, private readonly notifier: IncidentNotifier) {}

  async observe(monitorId: string, result: CheckResult) {
    if (result.isSuccess) {
      this.consecutiveFailures.delete(monitorId);
      const incident = await this.repository.resolve(monitorId);
      this.knownOpenIncidents.delete(monitorId);
      if (incident) this.notifier.notify("resolved", monitorId, incident);
      return;
    }

    const failures = (this.consecutiveFailures.get(monitorId) ?? 0) + 1;
    this.consecutiveFailures.set(monitorId, failures);
    if (failures < 3 || this.knownOpenIncidents.has(monitorId)) return;

    // The repository insert is idempotent: the database's partial unique index
    // permits at most one open incident even with concurrent worker instances.
    const incident = await this.repository.open(monitorId, failureReason(result));
    // A null result means another worker already owns the open incident.
    this.knownOpenIncidents.add(monitorId);
    if (incident) this.notifier.notify("opened", monitorId, incident, failureReason(result));
  }
}
