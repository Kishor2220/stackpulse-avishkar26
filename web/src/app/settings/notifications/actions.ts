"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type EmailPreferenceActionState = { success?: string; error?: string };

const preferencesSchema = z.object({
  incidentOpenEnabled: z.boolean(),
  incidentRecoveryEnabled: z.boolean(),
});

export async function saveEmailPreferences(_previous: EmailPreferenceActionState, formData: FormData): Promise<EmailPreferenceActionState> {
  const parsed = preferencesSchema.safeParse({
    incidentOpenEnabled: formData.get("incidentOpenEnabled") === "on",
    incidentRecoveryEnabled: formData.get("incidentRecoveryEnabled") === "on",
  });
  if (!parsed.success) return { error: "Invalid notification settings." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const { error } = await supabase.from("email_notification_preferences").upsert({
    owner_id: user.id,
    incident_open_enabled: parsed.data.incidentOpenEnabled,
    incident_recovery_enabled: parsed.data.incidentRecoveryEnabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (error) return { error: "Email preferences could not be saved. Confirm the email delivery migration is applied." };
  revalidatePath("/settings/notifications");
  return { success: "Email notification preferences saved." };
}
