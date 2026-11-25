"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const notificationIdSchema = z.string().uuid();

export async function markNotificationRead(formData: FormData) {
  const id = notificationIdSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("owner_id", user.id)
    .is("read_at", null);
  revalidatePath("/");
}
