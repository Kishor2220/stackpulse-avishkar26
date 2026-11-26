"use client";

import { useActionState } from "react";
import { saveEmailPreferences, type EmailPreferenceActionState } from "./actions";

const initialState: EmailPreferenceActionState = {};

export function PreferencesForm({ incidentOpenEnabled, incidentRecoveryEnabled }: { incidentOpenEnabled: boolean; incidentRecoveryEnabled: boolean }) {
  const [state, action, pending] = useActionState(saveEmailPreferences, initialState);
  return <form action={action} className="mt-6 space-y-4"><fieldset className="space-y-3"><legend className="text-sm font-medium text-slate-200">Incident email alerts</legend><label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4"><input className="mt-0.5 size-4 accent-cyan-300" name="incidentOpenEnabled" type="checkbox" defaultChecked={incidentOpenEnabled} /><span><span className="block text-sm font-medium text-slate-200">Incident opened</span><span className="mt-1 block text-xs leading-5 text-slate-500">Email me when StackPulse confirms an outage after three failed checks.</span></span></label><label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4"><input className="mt-0.5 size-4 accent-cyan-300" name="incidentRecoveryEnabled" type="checkbox" defaultChecked={incidentRecoveryEnabled} /><span><span className="block text-sm font-medium text-slate-200">Incident resolved</span><span className="mt-1 block text-xs leading-5 text-slate-500">Email me when a successful check confirms recovery.</span></span></label></fieldset>{state.error && <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200" role="alert">{state.error}</p>}{state.success && <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200" role="status">{state.success}</p>}<button className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#05202a] disabled:opacity-60" type="submit" disabled={pending}>{pending ? "Saving..." : "Save email preferences"}</button></form>;
}
