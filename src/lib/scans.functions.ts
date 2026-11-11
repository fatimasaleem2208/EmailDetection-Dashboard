import { createServerFn } from "@tanstack/react-start";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  analyzeInputSchema,
  historyQuerySchema,
  idSchema,
} from "@/lib/scan-schemas";
import { explainWithAi, fallbackExplanation, runAnalysis } from "@/lib/scans.server";

export const analyzeAndSaveScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => analyzeInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = runAnalysis({
      subject: data.subject,
      sender: data.sender ?? "",
      body: data.body,
    });

    const aiText = data.useAi
      ? await explainWithAi(
          { subject: data.subject, sender: data.sender ?? "", body: data.body },
          result,
        )
      : null;
    const explanation = aiText ?? fallbackExplanation(result);

    const { data: row, error } = await context.supabase
      .from("scans")
      .insert({
        user_id: context.userId,
        subject: data.subject.slice(0, 500),
        sender: (data.sender ?? "").slice(0, 320),
        body: data.body.slice(0, 60000),
        verdict: result.verdict,
        risk_score: result.riskScore,
        confidence: result.confidence,
        threat_level: result.threatLevel,
        indicators: result.indicators as unknown as Json,
        urls: result.urls as unknown as Json,
        headers: result.headers as unknown as Json,
        iocs: result.iocs as unknown as Json,
        recommendations: result.recommendations as unknown as Json,
        click_impact: result.clickImpact as unknown as Json,
        ai_explanation: explanation,
        source: data.source,
      })
      .select("*")
      .single();

    if (error) {
      console.error("scan insert failed", error);
      throw new Error("Could not save the scan result.");
    }

    await context.supabase.from("activity_logs").insert({
      user_id: context.userId,
      action: "email_scanned",
      detail: `${result.verdict === "phishing" ? "Phishing" : "Legitimate"} — "${data.subject.slice(0, 80) || "(no subject)"}" (risk ${result.riskScore})`,
      severity: result.riskScore >= 80 ? "critical" : result.riskScore >= 45 ? "warning" : "info",
    });

    return { scan: row, aiAvailable: aiText !== null, reputation: result.reputation };
  });

export const listScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => historyQuerySchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("scans")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.verdict !== "all") query = query.eq("verdict", data.verdict);
    if (data.search) query = query.ilike("subject", `%${data.search}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error("Could not load scan history.");
    return rows ?? [];
  });

export const getScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scans")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Could not load that scan.");
    return row;
  });

export const deleteScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scans")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not delete that scan.");
    await context.supabase.from("activity_logs").insert({
      user_id: context.userId,
      action: "scan_deleted",
      detail: `Scan ${data.id.slice(0, 8)} removed from history`,
      severity: "info",
    });
    return { ok: true };
  });

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [scansRes, logsRes, profileRes] = await Promise.all([
      context.supabase
        .from("scans")
        .select("id, subject, sender, verdict, risk_score, threat_level, confidence, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(500),
      context.supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(12),
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
    ]);

    return {
      scans: scansRes.data ?? [],
      logs: logsRes.data ?? [],
      profile: profileRes.data ?? null,
    };
  });

export const getActivityLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });
