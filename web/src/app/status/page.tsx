import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { formatTimestamp } from "@/lib/monitor-health";
import { hourlyStatusBars, parsePublicStatus, publicMonitorHealth, type PublicMonitor } from "@/lib/public-status";

function StatusFallback() {
  return <main className="grid min-h-screen place-items-center bg-[#07111b] px-5 text-slate-400"><p className="text-sm">Loading public status...</p></main>;
}

function StatusBadge({ state }: { state: "up" | "down" | "stale" | "no-data" }) {
  const style = { up: "bg-emerald-400/10 text-emerald-200", down: "bg-red-400/10 text-red-200", stale: "bg-amber-400/10 text-amber-100", "no-data": "bg-slate-700/60 text-slate-300" }[state];
  const label = { up: "Up", down: "Down", stale: "Unknown", "no-data": "No data yet" }[state];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

function PublicMonitorCard({ monitor, observedAt }: { monitor: PublicMonitor; observedAt: string }) {
  const health = publicMonitorHealth(monitor, observedAt);
  const bars = hourlyStatusBars(monitor.checks_24h, observedAt);
  const coveredHours = bars.filter((bar) => bar.state !== "missing").length;
  const barStyle = { up: "bg-emerald-400", down: "bg-red-400", missing: "bg-slate-700" };

  return <article className="rounded-xl border border-white/[0.08] bg-[#0b1a26] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">{monitor.name}</h2><p className="mt-1 text-sm text-slate-500">Last checked: {formatTimestamp(monitor.latest_check?.checked_at ?? null)}</p></div><StatusBadge state={health.state} /></div><div className="mt-5"><div className="flex items-center justify-between gap-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">24-hour history</p><p className="text-xs text-slate-400">{coveredHours === 0 ? "No coverage" : `${coveredHours}/24 hours covered`}</p></div><div className="mt-2 flex h-9 gap-1" aria-label="24 hourly monitoring status bars">{bars.map((bar, index) => <div key={`${bar.label}-${index}`} className={`flex-1 rounded-sm ${barStyle[bar.state]}`} title={`${bar.label}:00 UTC — ${bar.state === "missing" ? "No coverage" : bar.state === "up" ? "Up" : "Down"}`} />)}</div><div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>{bars[0].label}:00</span><span>{bars[23].label}:00 UTC</span></div></div><div className="mt-5 grid gap-4 border-t border-white/[0.07] pt-4 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-slate-500">Recorded 24h uptime</p><p className="mt-1 text-lg font-semibold text-slate-100">{health.uptimePercent === null ? "No coverage" : `${health.uptimePercent.toFixed(2)}%`}</p><p className="mt-1 text-xs text-slate-500">{health.totalChecks} recorded check{health.totalChecks === 1 ? "" : "s"}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Incident timeline</p>{monitor.incidents.length === 0 ? <p className="mt-1 text-sm text-slate-400">No incidents recorded.</p> : <ul className="mt-1 space-y-2">{monitor.incidents.map((incident, index) => <li key={`${incident.opened_at}-${index}`} className="text-sm text-slate-300"><span className={incident.status === "open" ? "text-red-200" : "text-emerald-200"}>{incident.status === "open" ? "Open" : "Resolved"}</span><span className="text-slate-500"> · Opened {formatTimestamp(incident.opened_at)}{incident.resolved_at ? ` · Resolved ${formatTimestamp(incident.resolved_at)}` : ""}</span></li>)}</ul>}</div></div></article>;
}

export default function StatusPage() {
  return <Suspense fallback={<StatusFallback />}><PublicStatus /></Suspense>;
}

async function PublicStatus() {
  await connection();
  const observedAt = new Date().toISOString();
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_status");
  const monitors = parsePublicStatus(data);

  return <main className="min-h-screen bg-[#07111b] text-slate-100"><header className="border-b border-white/[0.07] bg-[#091620]"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8"><Link className="text-lg font-semibold tracking-tight" href="/"><span>Stack</span><span className="text-cyan-300">Pulse</span></Link><span className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs font-medium text-cyan-200">Public status</span></div></header><section className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><p className="text-sm font-medium text-cyan-300">AVISHKAR&apos;26 prototype</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">System status</h1><p className="mt-2 text-sm leading-6 text-slate-400">Live reporting from monitors explicitly shared by their owners. Missing coverage is shown as unknown, not healthy.</p>{error ? <div className="mt-8 rounded-xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-100">Public monitoring data is temporarily unavailable. Please try again shortly.</div> : monitors.length === 0 ? <div className="mt-8 rounded-xl border border-white/[0.08] bg-[#0b1a26] p-8 text-center"><p className="font-medium text-slate-200">No public monitors yet</p><p className="mt-2 text-sm text-slate-500">Monitor owners can enable public visibility from their private dashboard.</p></div> : <div className="mt-8 space-y-4">{monitors.map((monitor, index) => <PublicMonitorCard key={`${monitor.name}-${index}`} monitor={monitor} observedAt={observedAt} />)}</div>}<p className="mt-8 text-xs text-slate-600">Status data refreshes when this page is reloaded. Times are shown in UTC.</p></section></main>;
}
