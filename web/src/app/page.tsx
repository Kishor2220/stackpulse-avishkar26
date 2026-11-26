import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "./auth/actions";
import { DashboardRefresh } from "./dashboard-refresh";
import { IncidentsPanel, type DashboardIncident } from "./incidents-panel";
import { MonitorManager } from "./monitor-manager";
import { NotificationsPanel, type DashboardNotification } from "./notifications-panel";
import { TrustPulsePanel } from "./trustpulse-panel";
import { createClient } from "@/lib/supabase/server";
import type { DashboardMonitor, MonitorCheck } from "@/lib/monitor-health";
import { parseTrustPulseData, type TrustPulseData } from "@/lib/trustpulse-health";

type IconName = "activity" | "bell" | "chevron" | "clock" | "globe" | "heart" | "layout" | "menu" | "pulse" | "settings" | "shield";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" />,
    layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    pulse: <><path d="M3 12h3l2-6 4 12 3-8 2 2h4" /><circle cx="12" cy="12" r="9" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
    shield: <path d="M12 3 4.5 6v5c0 4.7 3.2 8.9 7.5 10 4.3-1.1 7.5-5.3 7.5-10V6L12 3Z" />,
  };

  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

const navItems: { label: string; icon: IconName; active?: boolean }[] = [
  { label: "Overview", icon: "layout", active: true }, { label: "Monitors", icon: "globe" }, { label: "Incidents", icon: "bell" }, { label: "TrustPulse", icon: "heart" },
];
const metricCards: { label: string; icon: IconName }[] = [
  { label: "Uptime", icon: "pulse" }, { label: "Response time", icon: "clock" }, { label: "HTTP status", icon: "activity" }, { label: "TLS certificate", icon: "shield" },
];

function DashboardFallback() {
  return <main className="grid min-h-screen place-items-center bg-[#07111b] px-5 text-slate-400"><p className="text-sm">Loading your monitoring workspace…</p></main>;
}

export default function Home() {
  return <Suspense fallback={<DashboardFallback />}><Dashboard /></Suspense>;
}

async function Dashboard() {
  // Supabase verifies and refreshes session expiry using current time. Deferring
  // this boundary to request time keeps that work out of the static shell.
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const observedAt = new Date().toISOString();

  const { data, error } = await supabase.from("monitors")
    .select("id, name, url, expected_http_status, check_interval_seconds, is_active, is_public")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  const monitorRows = (data ?? []) as Omit<DashboardMonitor, "latestCheck" | "checks24h">[];
  const monitorIds = monitorRows.map((monitor) => monitor.id);
  const since = new Date(Date.parse(observedAt) - 24 * 60 * 60 * 1_000).toISOString();
  let checks24h: MonitorCheck[] = [];
  let checksError = error;
  const latestByMonitor = new Map<string, MonitorCheck | null>();

  if (monitorIds.length > 0) {
    const history = await supabase.from("monitor_checks")
      .select("id, monitor_id, checked_at, http_status, response_latency_ms, is_success, tls_expires_at")
      .in("monitor_id", monitorIds)
      .gte("checked_at", since)
      .order("checked_at", { ascending: true });
    checks24h = (history.data ?? []) as MonitorCheck[];
    checksError ||= history.error;

    const latestResults = await Promise.all(monitorIds.map(async (monitorId) => {
      const result = await supabase.from("monitor_checks")
        .select("id, monitor_id, checked_at, http_status, response_latency_ms, is_success, tls_expires_at")
        .eq("monitor_id", monitorId)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { monitorId, data: result.data as MonitorCheck | null, error: result.error };
    }));
    for (const result of latestResults) {
      latestByMonitor.set(result.monitorId, result.data);
      checksError ||= result.error;
    }
  }

  const monitors: DashboardMonitor[] = monitorRows.map((monitor) => ({
    ...monitor,
    latestCheck: latestByMonitor.get(monitor.id) ?? null,
    checks24h: checks24h.filter((check) => check.monitor_id === monitor.id),
  }));
  let incidents: DashboardIncident[] = [];
  if (monitorIds.length > 0) {
    const incidentResult = await supabase.from("incidents")
      .select("id, monitor_id, opened_at, resolved_at, failure_reason, status")
      .in("monitor_id", monitorIds)
      .order("opened_at", { ascending: false })
      .limit(50);
    incidents = (incidentResult.data ?? []) as DashboardIncident[];
    checksError ||= incidentResult.error;
  }
  const notificationResult = await supabase.from("notifications")
    .select("id, monitor_id, incident_id, type, title, body, read_at, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const notifications = (notificationResult.data ?? []) as DashboardNotification[];
  const trustPulseResult = await supabase.rpc("get_trustpulse_health");
  const trustPulse: TrustPulseData | null = trustPulseResult.error ? null : parseTrustPulseData(trustPulseResult.data);
  const trustPulseError = Boolean(trustPulseResult.error) || trustPulse === null;
  const monitorNames = new Map(monitorRows.map((monitor) => [monitor.id, monitor.name]));

  return <main className="min-h-screen bg-[#07111b] text-slate-100">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-white/[0.07] bg-[#091620] p-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2"><div className="grid size-9 place-items-center rounded-xl bg-cyan-400 text-[#06121a] shadow-[0_0_24px_rgba(34,211,238,0.24)]"><Icon name="pulse" className="size-5" /></div><span className="text-lg font-semibold tracking-tight">Stack<span className="text-cyan-300">Pulse</span></span></div>
      <nav className="mt-10 space-y-1" aria-label="Main navigation">{navItems.map((item) => <a key={item.label} href="#" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${item.active ? "bg-cyan-400/10 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}><Icon name={item.icon} className="size-[18px]" />{item.label}</a>)}</nav>
      <div className="mt-auto border-t border-white/[0.07] pt-5"><a href="/settings/notifications" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"><Icon name="settings" className="size-[18px]" />Settings</a><div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"><p className="text-xs font-medium text-slate-300">Ready when you are</p><p className="mt-1 text-xs leading-5 text-slate-500">Create a monitor to start collecting status data.</p></div></div>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#07111b]/90 px-5 backdrop-blur lg:px-8"><div className="flex items-center gap-3 lg:hidden"><div className="grid size-8 place-items-center rounded-lg bg-cyan-400 text-[#06121a]"><Icon name="pulse" className="size-4" /></div><span className="font-semibold">StackPulse</span></div><button className="hidden items-center gap-2 rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-400 sm:flex" type="button"><Icon name="globe" className="size-3.5" />All monitors <Icon name="chevron" className="size-3.5" /></button><button className="text-slate-400 lg:hidden" type="button" aria-label="Open navigation"><Icon name="menu" className="size-5" /></button><div className="flex items-center gap-3"><a className="hidden text-xs font-medium text-cyan-300 hover:text-cyan-200 sm:block" href="/status">Public status</a><a className="relative hidden rounded-lg p-2 text-slate-400 hover:bg-white/5 sm:block" href="#notifications" aria-label="View notifications"><Icon name="bell" className="size-5" />{notifications.filter((notification) => !notification.read_at).length > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-cyan-300" />}</a><form action={logout}><button className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 text-xs font-bold text-slate-950" type="submit" title="Sign out" aria-label={`Sign out ${user.email ?? ""}`}>SP</button></form></div></header>
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10"><DashboardRefresh /><div><p className="text-sm font-medium text-cyan-300">Monitoring workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Overview</h1><p className="mt-2 text-sm text-slate-400">A clear view of your endpoint and user-trust signals. Refreshes about every 30 seconds.</p></div>
        {checksError && <p className="mt-5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">Monitoring data could not be loaded. Existing monitor settings are still available.</p>}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map((metric) => <article key={metric.label} className="rounded-xl border border-white/[0.08] bg-[#0b1a26] p-4"><div className="flex items-start justify-between"><div className="grid size-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><Icon name={metric.icon} className="size-[18px]" /></div><span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-400">Per monitor</span></div><h2 className="mt-5 text-sm font-medium text-slate-300">{metric.label}</h2><p className="mt-1 text-sm text-slate-500">Actual results shown below</p></article>)}</div>
        <MonitorManager monitors={monitors} observedAt={observedAt} />
        <TrustPulsePanel data={trustPulse} observedAt={observedAt} error={trustPulseError} />
        <section className="mt-4"><NotificationsPanel notifications={notifications} monitorNames={monitorNames} error={Boolean(notificationResult.error)} /></section>
        <section className="mt-4 grid gap-4 lg:grid-cols-5"><IncidentsPanel incidents={incidents} monitorNames={monitorNames} /></section>
      </section>
    </div>
  </main>;
}
