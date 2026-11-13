import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuditScanType = "email" | "url" | "attachment";
export type AuditEventType = "result_saved" | "analysis_summary" | "scan_deleted";

// Call only from trusted authenticated server functions, after an actual operation.
// Never include message bodies, full URLs, filenames, or secret credentials in details.
export async function recordScanAudit(
  supabase: { from: (table: "scan_audit_events") => any },
  userId: string,
  scanId: string,
  scanType: AuditScanType,
  eventType: AuditEventType,
  details: Record<string, Json> = {},
): Promise<void> {
  try {
    const { error } = await supabase.from("scan_audit_events").insert({
      user_id: userId,
      scan_id: scanId,
      scan_type: scanType,
      event_type: eventType,
      details,
    });
    if (error) console.warn("scan audit recording failed", error.code ?? "unknown");
  } catch {
    // Never make a completed analysis disappear because an audit write failed.
    console.warn("scan audit recording unavailable");
  }
}

const lookupSchema = z.object({
  scanId: z.string().uuid(),
  scanType: z.enum(["email", "url", "attachment"]),
});

export const getScanAuditTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => lookupSchema.parse(input))
  .handler(async ({ context, data }) => {
    // Ownership checks are reinforced through RLS and an explicit user_id filter.
    const { data: events, error } = await context.supabase
      .from("scan_audit_events")
      .select("id, scan_id, scan_type, event_type, details, created_at")
      .eq("user_id", context.userId)
      .eq("scan_id", data.scanId)
      .eq("scan_type", data.scanType)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error("Unable to retrieve audit trail. Confirm the scan audit SQL migration ran.");
    return events ?? [];
  });
