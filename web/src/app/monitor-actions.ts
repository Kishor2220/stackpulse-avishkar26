"use server";

import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { z } from "zod";
import { normalizeMonitorUrl, monitorInputSchema } from "@/lib/monitor-validation";
import { createClient } from "@/lib/supabase/server";

export type MonitorActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<"name" | "url" | "expectedHttpStatus" | "checkIntervalSeconds", string>>;
};

const initialMonitorState: MonitorActionState = {};
const monitorIdSchema = z.string().uuid();

function readMonitorInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    url: String(formData.get("url") ?? ""),
    expectedHttpStatus: String(formData.get("expectedHttpStatus") ?? "200"),
    checkIntervalSeconds: String(formData.get("checkIntervalSeconds") ?? "60"),
    isActive: formData.get("isActive") === "on",
  };
}

function validationState(error: z.ZodError): MonitorActionState {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  return {
    error: "Review the highlighted fields and try again.",
    fieldErrors: {
      name: fieldErrors.name?.[0],
      url: fieldErrors.url?.[0],
      expectedHttpStatus: fieldErrors.expectedHttpStatus?.[0],
      checkIntervalSeconds: fieldErrors.checkIntervalSeconds?.[0],
    },
  };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function parseMonitor(formData: FormData) {
  return monitorInputSchema.safeParseAsync(readMonitorInput(formData));
}

export async function createMonitor(previousState: MonitorActionState = initialMonitorState, formData: FormData): Promise<MonitorActionState> {
  void previousState;
  const { supabase, user } = await authenticatedClient();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const parsed = await parseMonitor(formData);
  if (!parsed.success) return validationState(parsed.error);

  const { error } = await supabase.from("monitors").insert({
    owner_id: user.id,
    name: parsed.data.name,
    url: normalizeMonitorUrl(parsed.data.url),
    expected_http_status: parsed.data.expectedHttpStatus,
    check_interval_seconds: parsed.data.checkIntervalSeconds,
    is_active: parsed.data.isActive,
  });

  if (error) return { error: "We could not save this monitor. Please try again." };
  revalidatePath("/");
  return { success: "Monitor created." };
}

export async function updateMonitor(previousState: MonitorActionState = initialMonitorState, formData: FormData): Promise<MonitorActionState> {
  void previousState;
  const id = monitorIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "This monitor could not be found." };

  const { supabase, user } = await authenticatedClient();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const parsed = await parseMonitor(formData);
  if (!parsed.success) return validationState(parsed.error);

  // `updated_at` is intentionally generated at action request time. With Cache
  // Components enabled, Next.js must not see this unstable value during a
  // dashboard prerender or revalidation pass.
  await connection();
  const { data, error } = await supabase.from("monitors").update({
    name: parsed.data.name,
    url: normalizeMonitorUrl(parsed.data.url),
    expected_http_status: parsed.data.expectedHttpStatus,
    check_interval_seconds: parsed.data.checkIntervalSeconds,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
  }).eq("id", id.data).eq("owner_id", user.id).select("id").maybeSingle();

  if (error || !data) return { error: "We could not update this monitor. It may no longer be available." };
  revalidatePath("/");
  return { success: "Monitor updated." };
}

export async function deleteMonitor(previousState: MonitorActionState = initialMonitorState, formData: FormData): Promise<MonitorActionState> {
  void previousState;
  const id = monitorIdSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "This monitor could not be found." };

  const { supabase, user } = await authenticatedClient();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const { data, error } = await supabase.from("monitors").delete().eq("id", id.data).eq("owner_id", user.id).select("id").maybeSingle();
  if (error || !data) return { error: "We could not delete this monitor. It may no longer be available." };

  revalidatePath("/");
  return { success: "Monitor deleted." };
}
