import { formatTimestamp } from "@/lib/monitor-health";
import { coveragePercent, getTrustPulseState, heartbeatAgeLabel, type TrustPulseData } from "@/lib/trustpulse-health";

type TrustPulsePanelProps = {
  data: TrustPulseData | null;
  observedAt: string;
  error: boolean;
};

const presentation = {
  healthy: { label: "Healthy", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", message: "Recent worker heartbeat confirms the monitoring pipeline is running." },
  delayed: { label: "Delayed", className: "border-amber-400/30 bg-amber-400/10 text-amber-200", message: "The worker missed its expected one-minute heartbeat. Check results may be delayed." },
  offline: { label: "Offline", className: "border-red-400/30 bg-red-400/10 text-red-200", message: "No worker heartbeat for over three scheduled intervals. Monitoring results may be stale." },
  unknown: { label: "Unknown", className: "border-slate-600 bg-slate-800/60 text-slate-300", message: "There is no recent heartbeat evidence for the monitoring pipeline." },
} as const;

export function TrustPulsePanel({ data, observedAt, error }: TrustPulsePanelProps) {
  const state = data ? getTrustPulseState(data.last_heartbeat_at, observedAt, data.heartbeat_interval_seconds) : "unknown";
  const status = presentation[state];
  const coverage = data ? coveragePercent(data.active_monitor_count, data.fresh_monitor_count) : null;

  return <section className="mt-9" aria-labelledby="trust-heading"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="trust-heading" className="text-base font-semibold text-white">TrustPulse monitoring health</h2><p className="mt-1 text-sm text-slate-500">Live evidence for StackPulse&apos;s monitoring pipeline.</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span></div>
    <article className="mt-4 rounded-xl border border-white/[0.08] bg-[#0b1a26] p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-medium text-white">Worker heartbeat</h3><p className="mt-1 text-sm leading-6 text-slate-400">{status.message}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300" aria-hidden="true">♥</span></div>
      {error ? <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">TrustPulse data could not be loaded. Worker health is unknown.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Last heartbeat" value={data ? formatTimestamp(data.last_heartbeat_at) : "Unavailable"} /><Metric label="Heartbeat age" value={data ? heartbeatAgeLabel(data.last_heartbeat_at, observedAt) : "Unknown"} /><Metric label="Active monitors" value={data ? String(data.active_monitor_count) : "Unknown"} /><Metric label="Fresh checks" value={data ? `${data.fresh_monitor_count}${data.active_monitor_count > 0 ? ` / ${data.active_monitor_count}` : ""}` : "Unknown"} /></div>}
      {!error && <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.025] px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-300">Monitoring coverage</p><p className="text-sm font-semibold text-cyan-200">{coverage === null ? "No active monitors" : `${coverage.toFixed(0)}%`}</p></div><p className="mt-1 text-xs text-slate-500">{data && data.active_monitor_count > 0 ? `${data.fresh_monitor_count} of ${data.active_monitor_count} active monitors have a fresh check within two configured intervals.` : "Coverage is calculated when active monitors exist."}</p></div>}
    </article>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-200">{value}</p></div>;
}
