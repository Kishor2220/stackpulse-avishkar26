import { formatTimestamp } from "@/lib/monitor-health";

export type DashboardIncident = {
  id: string;
  monitor_id: string;
  opened_at: string;
  resolved_at: string | null;
  failure_reason: string;
  status: "open" | "resolved";
};

export function IncidentsPanel({ incidents, monitorNames }: { incidents: DashboardIncident[]; monitorNames: Map<string, string> }) {
  return <article className="rounded-xl border border-white/[0.08] bg-[#0b1a26] p-5 lg:col-span-2"><div className="flex items-start justify-between"><div><h3 className="font-medium text-white">Incidents</h3><p className="mt-1 text-sm text-slate-500">Open and recent recorded incidents.</p></div><span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[11px] text-slate-400">{incidents.length}</span></div>{incidents.length === 0 ? <div className="mt-8 rounded-lg border border-dashed border-white/[0.12] px-4 py-5 text-center"><p className="text-sm font-medium text-slate-400">No incident data yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Incidents appear after three consecutive recorded failures.</p></div> : <ul className="mt-4 max-h-64 divide-y divide-white/[0.07] overflow-y-auto">{incidents.map((incident) => <li key={incident.id} className="py-3 first:pt-0"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-medium text-slate-200">{monitorNames.get(incident.monitor_id) ?? "Deleted monitor"}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${incident.status === "open" ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{incident.status === "open" ? "Open" : "Resolved"}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{incident.failure_reason}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Opened {formatTimestamp(incident.opened_at)}{incident.resolved_at ? ` · Resolved ${formatTimestamp(incident.resolved_at)}` : " · Awaiting recovery"}</p></li>)}</ul>}</article>;
}
