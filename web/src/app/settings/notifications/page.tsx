import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PreferencesForm } from "./preferences-form";
import { createClient } from "@/lib/supabase/server";

function Fallback() { return <main className="grid min-h-screen place-items-center bg-[#07111b] text-sm text-slate-400">Loading notification settings...</main>; }
export default function NotificationSettingsPage() { return <Suspense fallback={<Fallback />}><Settings /></Suspense>; }
async function Settings() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("email_notification_preferences").select("incident_open_enabled, incident_recovery_enabled").eq("owner_id", user.id).maybeSingle();
  const preferences = data as { incident_open_enabled: boolean; incident_recovery_enabled: boolean } | null;
  return <main className="min-h-screen bg-[#07111b] px-5 py-10 text-slate-100 sm:px-8"><div className="mx-auto max-w-2xl"><Link className="text-sm font-medium text-cyan-300 hover:text-cyan-200" href="/">← Back to dashboard</Link><p className="mt-8 text-sm font-medium text-cyan-300">Settings</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Email notifications</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Choose which confirmed incident events may be queued for email delivery. Alerts remain disabled until you save an opt-in preference.</p><section className="mt-8 rounded-xl border border-white/[0.08] bg-[#0b1a26] p-5 sm:p-6">{error ? <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">Email settings are unavailable. Confirm the email-only delivery migration is applied.</p> : <PreferencesForm incidentOpenEnabled={preferences?.incident_open_enabled ?? false} incidentRecoveryEnabled={preferences?.incident_recovery_enabled ?? false} />}</section></div></main>;
}
