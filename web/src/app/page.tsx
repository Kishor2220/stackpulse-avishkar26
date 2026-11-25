type IconName =
  | "activity" | "bell" | "chevron" | "clock" | "globe" | "heart"
  | "layout" | "lock" | "menu" | "plus" | "pulse" | "settings" | "shield";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" />,
    layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    plus: <path d="M12 5v14M5 12h14" />,
    pulse: <><path d="M3 12h3l2-6 4 12 3-8 2 2h4" /><circle cx="12" cy="12" r="9" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
    shield: <path d="M12 3 4.5 6v5c0 4.7 3.2 8.9 7.5 10 4.3-1.1 7.5-5.3 7.5-10V6L12 3Z" />,
  };

  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

const navItems: { label: string; icon: IconName; active?: boolean }[] = [
  { label: "Overview", icon: "layout", active: true }, { label: "Monitors", icon: "globe" },
  { label: "Incidents", icon: "bell" }, { label: "TrustPulse", icon: "heart" },
];
const metricCards: { label: string; detail: string; icon: IconName }[] = [
  { label: "Uptime", detail: "Awaiting checks", icon: "pulse" }, { label: "Response time", detail: "Awaiting checks", icon: "clock" },
  { label: "HTTP status", detail: "Awaiting checks", icon: "activity" }, { label: "TLS certificate", detail: "Awaiting checks", icon: "lock" },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <main className="min-h-screen bg-[#07111b] text-slate-100">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-white/[0.07] bg-[#091620] p-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2"><div className="grid size-9 place-items-center rounded-xl bg-cyan-400 text-[#06121a] shadow-[0_0_24px_rgba(34,211,238,0.24)]"><Icon name="pulse" className="size-5" /></div><span className="text-lg font-semibold tracking-tight">Stack<span className="text-cyan-300">Pulse</span></span></div>
      <nav className="mt-10 space-y-1" aria-label="Main navigation">{navItems.map((item) => <a key={item.label} href="#" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${item.active ? "bg-cyan-400/10 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}><Icon name={item.icon} className="size-[18px]" />{item.label}</a>)}</nav>
      <div className="mt-auto border-t border-white/[0.07] pt-5"><a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"><Icon name="settings" className="size-[18px]" />Settings</a><div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"><p className="text-xs font-medium text-slate-300">Ready when you are</p><p className="mt-1 text-xs leading-5 text-slate-500">Create a monitor to start collecting status data.</p></div></div>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#07111b]/90 px-5 backdrop-blur lg:px-8"><div className="flex items-center gap-3 lg:hidden"><div className="grid size-8 place-items-center rounded-lg bg-cyan-400 text-[#06121a]"><Icon name="pulse" className="size-4" /></div><span className="font-semibold">StackPulse</span></div><button className="hidden items-center gap-2 rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-400 sm:flex" type="button"><Icon name="globe" className="size-3.5" />All monitors <Icon name="chevron" className="size-3.5" /></button><button className="text-slate-400 lg:hidden" type="button" aria-label="Open navigation"><Icon name="menu" className="size-5" /></button><div className="flex items-center gap-3"><button className="hidden rounded-lg p-2 text-slate-400 hover:bg-white/5 sm:block" type="button" aria-label="Notifications"><Icon name="bell" className="size-5" /></button><form action={logout}><button className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 text-xs font-bold text-slate-950" type="submit" title="Sign out" aria-label={`Sign out ${user.email ?? ""}`}>SP</button></form></div></header>
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-cyan-300">Monitoring workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Overview</h1><p className="mt-2 text-sm text-slate-400">A clear view of your endpoint and user-trust signals.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#05202a] shadow-[0_0_22px_rgba(103,232,249,0.18)] transition hover:bg-cyan-200" type="button"><Icon name="plus" className="size-4" />New monitor</button></div>
        <section className="mt-8" aria-labelledby="endpoint-heading"><div className="flex items-center justify-between"><div><h2 id="endpoint-heading" className="text-base font-semibold text-white">Endpoint monitoring</h2><p className="mt-1 text-sm text-slate-500">Availability and performance at a glance.</p></div><span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-400">No data yet</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map((metric) => <article key={metric.label} className="rounded-xl border border-white/[0.08] bg-[#0b1a26] p-4"><div className="flex items-start justify-between"><div className="grid size-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><Icon name={metric.icon} className="size-[18px]" /></div><span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-400">No data yet</span></div><h3 className="mt-5 text-sm font-medium text-slate-300">{metric.label}</h3><p className="mt-1 text-sm text-slate-500">{metric.detail}</p></article>)}</div><article className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1a26]"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><h3 className="font-medium text-white">Monitored endpoints</h3><p className="mt-1 text-sm text-slate-500">Add a URL to begin health checks.</p></div><button className="hidden items-center gap-1.5 text-sm font-medium text-cyan-300 hover:text-cyan-200 sm:flex" type="button">Add endpoint <Icon name="chevron" className="size-4" /></button></div><div className="grid min-h-52 place-items-center p-6 text-center"><div><div className="mx-auto grid size-11 place-items-center rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-300"><Icon name="globe" className="size-5" /></div><p className="mt-3 text-sm font-medium text-slate-300">No endpoints monitored yet</p><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Once you add an endpoint, its uptime, latency, HTTP status and TLS expiry will appear here.</p></div></div></article></section>
        <section className="mt-9" aria-labelledby="trust-heading"><div className="flex items-center justify-between"><div><h2 id="trust-heading" className="text-base font-semibold text-white">TrustPulse monitoring health</h2><p className="mt-1 text-sm text-slate-500">The health of StackPulse&apos;s own monitoring pipeline.</p></div><span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-400">No data yet</span></div><div className="mt-4 grid gap-4 lg:grid-cols-5"><article className="rounded-xl border border-white/[0.08] bg-[#0b1a26] p-5 lg:col-span-3"><div className="flex items-start justify-between"><div><h3 className="font-medium text-white">Monitoring coverage</h3><p className="mt-1 text-sm text-slate-500">Recent check activity across your workspace.</p></div><Icon name="shield" className="size-5 text-cyan-300" /></div><div className="mt-8 flex h-28 items-end gap-1.5 opacity-40" aria-label="No monitoring data"><div className="h-[18%] flex-1 rounded-t bg-slate-600" /><div className="h-[31%] flex-1 rounded-t bg-slate-600" /><div className="h-[23%] flex-1 rounded-t bg-slate-600" /><div className="h-[46%] flex-1 rounded-t bg-slate-600" /><div className="h-[35%] flex-1 rounded-t bg-slate-600" /><div className="h-[56%] flex-1 rounded-t bg-slate-600" /><div className="h-[42%] flex-1 rounded-t bg-slate-600" /><div className="h-[28%] flex-1 rounded-t bg-slate-600" /></div><p className="mt-3 text-xs text-slate-500">No check history available</p></article><article className="rounded-xl border border-white/[0.08] bg-[#0b1a26] p-5 lg:col-span-2"><div className="flex items-start justify-between"><div><h3 className="font-medium text-white">Incidents</h3><p className="mt-1 text-sm text-slate-500">Open and recent monitor incidents.</p></div><Icon name="bell" className="size-5 text-cyan-300" /></div><div className="mt-8 rounded-lg border border-dashed border-white/[0.12] px-4 py-5 text-center"><p className="text-sm font-medium text-slate-400">No incident data yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Incidents will be recorded after monitoring begins.</p></div></article></div></section>
      </section>
    </div>
  </main>;
}
import { redirect } from "next/navigation";
import { logout } from "./auth/actions";
import { createClient } from "@/lib/supabase/server";

// The dashboard reads the authenticated request cookie before rendering.
export const instant = false;

