"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTimestamp, type MonitorCheck } from "@/lib/monitor-health";
import { latencyChartData, type LatencyPoint } from "@/lib/latency-chart-data";

const pointColor = (point: LatencyPoint) => point.outcome === "success" ? "#34d399" : "#f87171";

function OutcomeDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: LatencyPoint }) {
  if (cx === undefined || cy === undefined || !payload || payload.latency === null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={pointColor(payload)} stroke="#07111b" strokeWidth={1.5} />;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: LatencyPoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="max-w-56 rounded-lg border border-white/[0.12] bg-[#0b1a26] px-3 py-2 text-xs shadow-xl"><p className="text-slate-300">{formatTimestamp(point.timestamp)}</p><p className="mt-1 text-slate-400">Outcome: <span className={point.outcome === "success" ? "text-emerald-200" : "text-red-200"}>{point.outcome === "success" ? "Successful" : "Failed"}</span></p><p className="text-slate-400">HTTP: <span className="text-slate-200">{point.httpStatus ?? "No response"}</span></p><p className="text-slate-400">Latency: <span className="text-slate-200">{point.latency === null ? "Not measured" : `${point.latency} ms`}</span></p>{point.failureCategory && <p className="text-slate-400">Failure: <span className="text-red-200">{point.failureCategory}</span></p>}</div>;
}

export function LatencyChart({ checks }: { checks: MonitorCheck[] }) {
  const data = latencyChartData(checks);
  const measured = data.filter((point) => point.latency !== null);
  if (data.length === 0) return <div className="grid h-52 place-items-center rounded-lg border border-dashed border-white/[0.1] text-xs text-slate-500">No monitoring observations in the last 24 hours.</div>;
  const min = Math.min(...measured.map((point) => point.latency ?? 0), 0);
  const max = Math.max(...measured.map((point) => point.latency ?? 0), 1);
  const padding = Math.max(50, Math.round((max - min) * 0.15));
  return <div className="h-56 sm:h-64" aria-label="Response latency chart"><ResponsiveContainer height="100%" width="100%"><LineChart data={data} margin={{ top: 16, right: 18, bottom: 12, left: 12 }}><XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={42} interval="preserveStartEnd" /><YAxis dataKey="latency" domain={[Math.max(0, min - padding), max + padding]} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={54} tickFormatter={(value: number) => `${value}`} label={{ value: "ms", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10, dx: -2 }} /><Tooltip content={<ChartTooltip />} /><Line type="linear" dataKey="latency" stroke="#22d3ee" strokeOpacity={0.65} strokeWidth={1.5} dot={<OutcomeDot />} activeDot={{ r: 5, stroke: "#e2e8f0", strokeWidth: 1 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer><p className="mt-1 text-[11px] text-slate-500"><span className="text-emerald-300">●</span> successful check <span className="ml-3 text-red-300">●</span> failed check <span className="ml-3 text-slate-500">—</span> gaps mean no measured latency</p></div>;
}
