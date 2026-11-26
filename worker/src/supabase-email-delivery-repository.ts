import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailDelivery, EmailDeliveryRepository } from "./email-dispatcher.js";

export class EmailDeliveryRepositoryError extends Error {
  constructor(readonly operation: "claim" | "accepted" | "retry" | "failed", readonly code: string) {
    super(`Email delivery ${operation} failed.`);
  }
}

function safeSupabaseCode(error: unknown) {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unknown";
}

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }

export function createSupabaseEmailDeliveryRepository(supabase: SupabaseClient): EmailDeliveryRepository {
  return {
    async claim(workerId, _now, leaseMs) {
      const { data, error } = await supabase.rpc("claim_email_delivery", { p_worker_id: workerId, p_lease_seconds: Math.ceil(leaseMs / 1_000) });
      if (error) throw new EmailDeliveryRepositoryError("claim", safeSupabaseCode(error));
      const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
      if (!row || typeof row.id !== "string" || typeof row.recipient !== "string" || typeof row.body_text !== "string" || typeof row.subject !== "string" || typeof row.owner_id !== "string" || typeof row.notification_id !== "string" || typeof row.attempt_count !== "number") return null;
      return { id: row.id, notificationId: row.notification_id, ownerId: row.owner_id, attemptCount: row.attempt_count, recipient: row.recipient, subject: row.subject, text: row.body_text, html: `<p>${escapeHtml(row.body_text)}</p>` };
    },
    async accepted(id, workerId, providerMessageId, now) { const { error } = await supabase.from("notification_deliveries").update({ status: "delivered", delivered_at: now.toISOString(), provider_message_id: providerMessageId, lease_owner: null, lease_expires_at: null }).eq("id", id).eq("lease_owner", workerId); if (error) throw new EmailDeliveryRepositoryError("accepted", safeSupabaseCode(error)); },
    async retry(id, workerId, attemptCount, nextAttemptAt, category, now) { const { error } = await supabase.from("notification_deliveries").update({ status: "pending", attempt_count: attemptCount, next_attempt_at: nextAttemptAt.toISOString(), last_attempt_at: now.toISOString(), error_category: category, lease_owner: null, lease_expires_at: null }).eq("id", id).eq("lease_owner", workerId); if (error) throw new EmailDeliveryRepositoryError("retry", safeSupabaseCode(error)); },
    async failed(id, workerId, category, now) { const { error } = await supabase.from("notification_deliveries").update({ status: "failed", last_attempt_at: now.toISOString(), error_category: category, lease_owner: null, lease_expires_at: null }).eq("id", id).eq("lease_owner", workerId); if (error) throw new EmailDeliveryRepositoryError("failed", safeSupabaseCode(error)); },
  };
}
