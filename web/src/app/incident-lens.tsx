import { diagnoseIncident } from "@/lib/incident-lens";

export function IncidentLens({ reason }: { reason: string }) {
  const diagnosis = diagnoseIncident(reason);
  return <details className="mt-2 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.03] p-2.5"><summary className="cursor-pointer text-xs font-medium text-cyan-200">IncidentLens guidance</summary><p className="mt-2 text-xs leading-5 text-slate-300"><span className="font-medium">Observed: </span>{diagnosis.observation}</p><p className="mt-1 text-xs leading-5 text-slate-400"><span className="font-medium text-slate-300">Possible cause: </span>{diagnosis.possibleCause}</p><p className="mt-1 text-xs leading-5 text-slate-400"><span className="font-medium text-slate-300">Next: </span>{diagnosis.nextStep}</p></details>;
}
