import { createServerFn } from "@tanstack/react-start";
import { isIP } from "node:net";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sha256"), value: z.string().regex(/^[a-f0-9]{64}$/i) }),
  z.object({ kind: z.literal("domain"), value: z.string().min(4).max(253) }),
]);

export type ThreatIntelFinding = {
  kind: "sha256" | "domain";
  value: string;
  state: "flagged" | "no-detections" | "not-found" | "not-configured" | "unavailable" | "skipped";
  malicious: number | null;
  suspicious: number | null;
  harmless: number | null;
  undetected: number | null;
  details: string;
  provider: "VirusTotal";
};

function domainToCheck(raw: string): string | null {
  const domain = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!domain || domain.length > 253 || isIP(domain) || !domain.includes(".") ||
      domain === "localhost" || /(^|\.)(localhost|local|internal|test|example|invalid)$/.test(domain) ||
      !/^[a-z0-9.-]+$/.test(domain) || domain.split(".").some(p => !p || p.length > 63 || p.startsWith("-") || p.endsWith("-"))) return null;
  return domain;
}

export const lookupThreatIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<ThreatIntelFinding> => {
    const empty = (state: ThreatIntelFinding["state"], details: string): ThreatIntelFinding => ({
      kind: data.kind, value: data.value, state, details, provider: "VirusTotal",
      malicious: null, suspicious: null, harmless: null, undetected: null,
    });
    const target = data.kind === "sha256" ? data.value.toLowerCase() : domainToCheck(data.value);
    if (!target) return empty("skipped", "Not a valid public domain; lookup skipped.");
    const key = process.env.VIRUSTOTAL_API_KEY;
    if (!key) return empty("not-configured", "VirusTotal API key is not configured. No lookup was performed.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      // Query metadata only. Never send attachment bytes, fetch the suspicious domain, or submit URLs.
      const endpoint = data.kind === "sha256" ? "files" : "domains";
      const response = await fetch(`https://www.virustotal.com/api/v3/${endpoint}/${encodeURIComponent(target)}`, {
        headers: { "x-apikey": key, accept: "application/json" },
        signal: controller.signal,
      });
      if (response.status === 404) return empty("not-found", "No existing report found. Unknown is not safe.");
      if (!response.ok) return empty("unavailable", response.status === 429
        ? "VirusTotal rate limit reached. Try later."
        : `VirusTotal returned HTTP ${response.status}. No verdict available.`);
      const payload = await response.json() as { data?: { attributes?: { last_analysis_stats?: Record<string, unknown> } } };
      const stats = payload?.data?.attributes?.last_analysis_stats;
      if (!stats) return empty("unavailable", "The provider did not return detection statistics.");
      const count = (k: string) => typeof stats[k] === "number" && Number.isFinite(stats[k]) ? Math.max(0, Math.floor(stats[k] as number)) : 0;
      const malicious = count("malicious"); const suspicious = count("suspicious");
      return {
        kind: data.kind, value: target, provider: "VirusTotal",
        state: malicious + suspicious > 0 ? "flagged" : "no-detections",
        malicious, suspicious, harmless: count("harmless"), undetected: count("undetected"),
        details: malicious + suspicious > 0
          ? "Security vendors have flagged this indicator. Review the counts and avoid assuming all detections are definitive."
          : "No vendor detections were reported in the existing record. This does not establish safety.",
      };
    } catch {
      return empty("unavailable", "Lookup timed out or could not reach the reputation service.");
    } finally { clearTimeout(timeout); }
  });
