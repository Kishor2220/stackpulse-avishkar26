export type WatchdogState = "healthy" | "stale" | "unknown";

export function classifyHeartbeat(lastHeartbeatAt: string | null, observedAt: string, staleAfterSeconds: number): WatchdogState {
  if (!lastHeartbeatAt || !Number.isFinite(staleAfterSeconds) || staleAfterSeconds <= 0) return "unknown";
  const age = Date.parse(observedAt) - Date.parse(lastHeartbeatAt);
  if (!Number.isFinite(age) || age < 0) return "unknown";
  return age <= staleAfterSeconds * 1_000 ? "healthy" : "stale";
}
