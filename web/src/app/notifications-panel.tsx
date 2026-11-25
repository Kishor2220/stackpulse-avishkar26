import { formatTimestamp } from "@/lib/monitor-health";
import { markNotificationRead } from "./notification-actions";

export type DashboardNotification = {
  id: string;
  monitor_id: string;
  incident_id: string;
  type: "incident_opened" | "incident_resolved";
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function NotificationsPanel({ notifications, monitorNames, error }: { notifications: DashboardNotification[]; monitorNames: Map<string, string>; error: boolean }) {
  return <article id="notifications" className="rounded-xl border border-white/[0.08] bg-[#0b1a26] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-medium text-white">Notifications</h2><p className="mt-1 text-sm text-slate-500">Incident events for your monitors.</p></div><span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[11px] text-slate-400">{notifications.filter((item) => !item.read_at).length} unread</span></div>
    {error ? <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">Notifications are unavailable until the notifications migration is applied.</p> : notifications.length === 0 ? <div className="mt-6 rounded-lg border border-dashed border-white/[0.12] px-4 py-5 text-center"><p className="text-sm font-medium text-slate-400">No notifications yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Incident opening and recovery events will appear here.</p></div> : <ul className="mt-4 divide-y divide-white/[0.07]">{notifications.map((notification) => <li key={notification.id} className={`py-3 first:pt-0 ${notification.read_at ? "opacity-65" : ""}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-200">{notification.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${notification.type === "incident_opened" ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}>{notification.type === "incident_opened" ? "Incident" : "Recovered"}</span></div><p className="mt-1 text-xs text-slate-400">{monitorNames.get(notification.monitor_id) ?? "Monitor"} · {notification.body}</p><p className="mt-1 text-[11px] text-slate-500">{formatTimestamp(notification.created_at)}</p></div>{!notification.read_at && <form action={markNotificationRead}><input name="id" type="hidden" value={notification.id} /><button className="shrink-0 text-xs font-medium text-cyan-300 hover:text-cyan-200" type="submit">Mark read</button></form>}</div></li>)}</ul>}
  </article>;
}
