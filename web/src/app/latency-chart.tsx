"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonitorCheck } from "@/lib/monitor-health";

export function LatencyChart({ checks }: { checks: MonitorCheck[] }) {
  const data = checks
    .filter((check) => check.response_latency_ms !== null)
    .sort((a, b) => a.checked_at.localeCompare(b.checked_at))
    .map((check) => ({ time: check.checked_at.slice(11, 16), latency: check.response_latency_ms }));

  if (data.length === 0) return <div className="grid h-32 place-items-center rounded-lg border border-dashed border-white/[0.1] text-xs text-slate-500">No latency data recorded in the last 24 hours.</div>;

  return <div className="h-32" aria-label="24-hour response latency chart"><ResponsiveContainer height="100%" width="100%"><AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}><defs><linearGradient id="latency-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis dataKey="latency" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} unit="ms" width={42} /><Tooltip contentStyle={{ background: "#0b1a26", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8 }} labelStyle={{ color: "#94a3b8" }} itemStyle={{ color: "#a5f3fc" }} formatter={(value) => [`${value} ms`, "Latency"]} /><Area type="monotone" dataKey="latency" stroke="#22d3ee" strokeWidth={2} fill="url(#latency-fill)" /></AreaChart></ResponsiveContainer></div>;
}
