"use client";

import { useActionState, useEffect, useState } from "react";
import { createMonitor, deleteMonitor, updateMonitor, type MonitorActionState } from "./monitor-actions";

export type Monitor = {
  id: string;
  name: string;
  url: string;
  expected_http_status: number;
  check_interval_seconds: number;
  is_active: boolean;
};

const emptyState: MonitorActionState = {};
type MonitorAction = (state: MonitorActionState, formData: FormData) => Promise<MonitorActionState>;

function MonitorForm({ monitor, onClose, onSuccess }: { monitor?: Monitor; onClose: () => void; onSuccess: (message: string) => void }) {
  const action: MonitorAction = monitor ? updateMonitor : createMonitor;
  const [state, formAction, pending] = useActionState(action, emptyState);

  useEffect(() => {
    if (state.success) {
      onSuccess(state.success);
      onClose();
    }
  }, [state.success, onClose, onSuccess]);

  return <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="monitor-form-title">
    <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0b1a26] p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-cyan-300">Endpoint configuration</p><h2 id="monitor-form-title" className="mt-1 text-xl font-semibold text-white">{monitor ? "Edit monitor" : "Create monitor"}</h2></div><button className="rounded-md px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-white" type="button" onClick={onClose} aria-label="Close">×</button></div>
      <form action={formAction} className="mt-6 space-y-4">
        {monitor && <input name="id" type="hidden" value={monitor.id} />}
        <label className="block text-sm font-medium text-slate-300">Monitor name<input className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-[#07111b] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" name="name" required maxLength={100} defaultValue={monitor?.name} placeholder="Marketing website" /></label>
        {state.fieldErrors?.name && <p className="-mt-2 text-xs text-red-300">{state.fieldErrors.name}</p>}
        <label className="block text-sm font-medium text-slate-300">HTTP/HTTPS URL<input className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-[#07111b] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" name="url" type="url" required maxLength={2048} defaultValue={monitor?.url} placeholder="https://example.com" /></label>
        {state.fieldErrors?.url && <p className="-mt-2 text-xs text-red-300">{state.fieldErrors.url}</p>}
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-300">Expected status<input className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-[#07111b] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" name="expectedHttpStatus" type="number" min="100" max="599" required defaultValue={monitor?.expected_http_status ?? 200} /></label><label className="block text-sm font-medium text-slate-300">Interval<select className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-[#07111b] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" name="checkIntervalSeconds" defaultValue={monitor?.check_interval_seconds ?? 60}><option value="30">Every 30 seconds</option><option value="60">Every 60 seconds</option><option value="120">Every 120 seconds</option></select></label></div>
        {(state.fieldErrors?.expectedHttpStatus || state.fieldErrors?.checkIntervalSeconds) && <p className="text-xs text-red-300">{state.fieldErrors.expectedHttpStatus ?? state.fieldErrors.checkIntervalSeconds}</p>}
        <label className="flex items-center gap-2 text-sm text-slate-300"><input className="size-4 accent-cyan-300" name="isActive" type="checkbox" defaultChecked={monitor?.is_active ?? true} />Active monitoring</label>
        {state.error && <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-sm text-red-200" role="alert">{state.error}</p>}
        <div className="flex justify-end gap-3 pt-2"><button className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5" type="button" onClick={onClose}>Cancel</button><button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#05202a] disabled:opacity-60" type="submit" disabled={pending}>{pending ? "Saving…" : monitor ? "Save changes" : "Create monitor"}</button></div>
      </form>
    </section>
  </div>;
}

function DeleteMonitorButton({ id, onSuccess }: { id: string; onSuccess: (message: string) => void }) {
  const [state, formAction, pending] = useActionState(deleteMonitor, emptyState);
  useEffect(() => { if (state.success) onSuccess(state.success); }, [state.success, onSuccess]);

  return <form action={formAction} onSubmit={(event) => { if (!window.confirm("Delete this monitor? This cannot be undone.")) event.preventDefault(); }}><input name="id" type="hidden" value={id} />{state.error && <p className="mb-1 text-xs text-red-300">{state.error}</p>}<button className="text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50" type="submit" disabled={pending}>{pending ? "Deleting…" : "Delete"}</button></form>;
}

export function MonitorManager({ monitors }: { monitors: Monitor[] }) {
  const [formMonitor, setFormMonitor] = useState<Monitor | null | undefined>(undefined);
  const [message, setMessage] = useState<string>();
  const closeForm = () => setFormMonitor(undefined);
  const notify = (success: string) => setMessage(success);
  const openCreate = () => setFormMonitor(null);

  return <>
    <div className="flex justify-end"><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#05202a] shadow-[0_0_22px_rgba(103,232,249,0.18)] transition hover:bg-cyan-200" type="button" onClick={openCreate}><span aria-hidden="true">+</span>New monitor</button></div>
    {message && <div className="mt-4 flex items-center justify-between rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-100" role="status">{message}<button className="text-cyan-200 hover:text-white" type="button" onClick={() => setMessage(undefined)} aria-label="Dismiss message">×</button></div>}
    <section className="mt-8" aria-labelledby="endpoint-heading"><div className="flex items-center justify-between"><div><h2 id="endpoint-heading" className="text-base font-semibold text-white">Endpoint monitoring</h2><p className="mt-1 text-sm text-slate-500">Availability and performance at a glance.</p></div><span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-400">{monitors.length ? `${monitors.length} monitor${monitors.length === 1 ? "" : "s"}` : "No data yet"}</span></div>
      <article className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b1a26]"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><h3 className="font-medium text-white">Monitored endpoints</h3><p className="mt-1 text-sm text-slate-500">Checks will appear after the monitoring worker is connected.</p></div><button className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300 hover:text-cyan-200" type="button" onClick={openCreate}>Add endpoint <span aria-hidden="true">→</span></button></div>
        {monitors.length === 0 ? <div className="grid min-h-52 place-items-center p-6 text-center"><div><div className="mx-auto grid size-11 place-items-center rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-300">⌁</div><p className="mt-3 text-sm font-medium text-slate-300">No endpoints monitored yet</p><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Add an HTTP or HTTPS endpoint to prepare it for monitoring.</p></div></div> : <ul className="divide-y divide-white/[0.07]">{monitors.map((monitor) => <li key={monitor.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate font-medium text-slate-200">{monitor.name}</h4><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${monitor.is_active ? "bg-cyan-400/10 text-cyan-200" : "bg-slate-700/60 text-slate-400"}`}>{monitor.is_active ? "Active" : "Paused"}</span></div><p className="mt-1 truncate text-sm text-slate-500">{monitor.url}</p><p className="mt-2 text-xs text-slate-400">Expected {monitor.expected_http_status} · Every {monitor.check_interval_seconds}s · <span className="text-slate-300">Awaiting first check</span></p></div><div className="flex items-center gap-4"><button className="text-sm font-medium text-cyan-300 hover:text-cyan-200" type="button" onClick={() => setFormMonitor(monitor)}>Edit</button><DeleteMonitorButton id={monitor.id} onSuccess={notify} /></div></li>)}</ul>}
      </article>
    </section>
    {formMonitor !== undefined && <MonitorForm monitor={formMonitor ?? undefined} onClose={closeForm} onSuccess={notify} />}
  </>;
}
