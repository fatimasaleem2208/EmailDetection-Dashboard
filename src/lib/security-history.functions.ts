import { createServerFn } from "@tanstack/react-start";
import { recordScanAudit } from "@/lib/scan-audit.functions";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { MOCK_USER_ID } from "@/integrations/supabase/mock";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  scanType: z.enum(["url", "attachment"]),
  target: z.string().min(1).max(500),
  riskLevel: z.enum(["low", "caution", "high", "unknown"]),
  riskScore: z.number().int().min(0).max(100).nullable().default(null),
  findings: z.array(z.string().max(400)).max(30),
  details: z.record(z.string(), z.unknown()).default({}),
});
const idSchema = z.object({ id: z.string().uuid() });
function requireRealUser(userId: string) {
  if (!userId || userId === MOCK_USER_ID) {
    throw new Error("Sign in with a real Supabase account to save scan history.");
  }
}

export const saveSecurityScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    requireRealUser(context.userId);
    const { data: row, error } = await context.supabase.from("security_scan_history")
      .insert({
        user_id: context.userId,
        scan_type: data.scanType,
        target: data.target,
        risk_level: data.riskLevel,
        risk_score: data.riskScore,
        findings: data.findings as Json,
        details: data.details as Json,
      }).select("*").single();
    if (error || !row) throw new Error("Could not save this scan. Check the Phase 5.1 SQL migration and authentication.");
    await recordScanAudit(context.supabase, context.userId, row.id, data.scanType, "result_saved");
    await recordScanAudit(context.supabase, context.userId, row.id, data.scanType, "analysis_summary", {
      risk_level: data.riskLevel,
      risk_score: data.riskScore,
      finding_count: data.findings.length,
    });
    await context.supabase.from("activity_logs").insert({
      user_id: context.userId,
      action: `${data.scanType}_scanned`,
      detail: `${data.scanType === "url" ? "URL" : "Attachment"} analyzed: ${data.target.slice(0,120)} (${data.riskLevel})`,
      severity: data.riskLevel === "high" ? "critical" : data.riskLevel === "caution" ? "warning" : "info",
    });
    return row;
  });

export const listSecurityScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    requireRealUser(context.userId);
    const { data, error } = await context.supabase.from("security_scan_history")
      .select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Unable to load URL/attachment history. Check the SQL migration.");
    return data ?? [];
  });

export const deleteSecurityScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    requireRealUser(context.userId);
    const { data: existing } = await context.supabase.from("security_scan_history")
      .select("scan_type").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    const { error } = await context.supabase.from("security_scan_history")
      .delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error("Unable to delete history entry.");
    if (existing?.scan_type === "url" || existing?.scan_type === "attachment") {
      await recordScanAudit(context.supabase, context.userId, data.id, existing.scan_type, "scan_deleted");
    }
    return { ok: true };
  });
