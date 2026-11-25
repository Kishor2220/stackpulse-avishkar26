import type { SupabaseClient } from "@supabase/supabase-js";
import type { IncidentRecord, IncidentRepository } from "./incident-manager.js";

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

export function createSupabaseIncidentRepository(supabase: SupabaseClient): IncidentRepository {
  return {
    async open(monitorId, reason) {
      const { data, error } = await supabase.from("incidents").insert({
        monitor_id: monitorId,
        failure_reason: reason,
        status: "open",
      }).select("id, opened_at").maybeSingle();
      if (isUniqueViolation(error)) return null;
      if (error || !data) throw new Error("Could not open incident.");
      return { id: data.id as string, openedAt: data.opened_at as string };
    },

    async resolve(monitorId) {
      const resolvedAt = new Date().toISOString();
      const { data, error } = await supabase.from("incidents").update({
        status: "resolved",
        resolved_at: resolvedAt,
      }).eq("monitor_id", monitorId).eq("status", "open").select("id, opened_at, resolved_at").maybeSingle();
      if (error) throw new Error("Could not resolve incident.");
      if (!data) return null;
      return { id: data.id as string, openedAt: data.opened_at as string, resolvedAt: data.resolved_at as string };
    },
  };
}
