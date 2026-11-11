import { createServerFn } from "@tanstack/react-start";
import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ urls: z.array(z.string().trim().min(1).max(2048)).min(1).max(10) });

export type UrlReputationFinding = {
  url: string;
  host: string;
  dnsStatus: "resolves" | "no-record" | "unavailable" | "skipped";
  dnsDetails: string;
  reputationStatus: "flagged" | "not-flagged" | "not-configured" | "unavailable" | "skipped";
  reputationDetails: string;
};

function validPublicHost(raw: string) {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("Use an absolute HTTP or HTTPS URL."); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  if (parsed.username || parsed.password) throw new Error("URLs containing credentials are not supported.");
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 253 || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".example") || host.endsWith(".invalid") || isIP(host) || !host.includes(".")) {
    throw new Error("Public domain names only; local, reserved and IP-literal hosts are skipped.");
  }
  return { host, url: parsed.toString() };
}

async function dnsCheck(host: string): Promise<Pick<UrlReputationFinding, "dnsStatus" | "dnsDetails">> {
  try {
    const answers = await Promise.allSettled([resolve4(host), resolve6(host)]);
    const resolved = answers.some((a) => a.status === "fulfilled" && a.value.length > 0);
    if (resolved) return { dnsStatus: "resolves", dnsDetails: "Public DNS records were found. This does not establish that the site is safe." };
    const failures = answers.filter((a) => a.status === "rejected");
    const nonexist = failures.every((a) => a.status === "rejected" && ["ENOTFOUND", "ENODATA", "ENODOMAIN"].includes((a.reason as {code?:string})?.code ?? ""));
    return nonexist
      ? { dnsStatus: "no-record", dnsDetails: "No public A or AAAA DNS records were found at the time of this check." }
      : { dnsStatus: "unavailable", dnsDetails: "DNS lookup was unsuccessful; the result is inconclusive." };
  } catch {
    return { dnsStatus: "unavailable", dnsDetails: "DNS service unavailable; result is inconclusive." };
  }
}

async function safeBrowsingCheck(url: string): Promise<Pick<UrlReputationFinding, "reputationStatus" | "reputationDetails">> {
  const key = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!key) return { reputationStatus: "not-configured", reputationDetails: "Google Safe Browsing is not configured; no external reputation lookup was performed." };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      // Only contacts Google's API, never the user-supplied URL. The submitted URL is shared with Google.
      const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ client: { clientId: "emaildetection", clientVersion: "1.0" }, threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url }],
        } }),
      });
      if (!response.ok) return { reputationStatus: "unavailable", reputationDetails: `Reputation provider returned HTTP ${response.status}; no verdict available.` };
      const payload: unknown = await response.json();
      const matches = (payload as { matches?: unknown })?.matches;
      return Array.isArray(matches) && matches.length > 0
        ? { reputationStatus: "flagged", reputationDetails: "Google Safe Browsing reported a threat match for this URL." }
        : { reputationStatus: "not-flagged", reputationDetails: "No match was returned by Google Safe Browsing at check time. This does NOT certify the URL safe." };
    } finally { clearTimeout(timeout); }
  } catch {
    return { reputationStatus: "unavailable", reputationDetails: "Reputation lookup timed out or failed; no verdict available." };
  }
}

export const checkUrlReputation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const findings: UrlReputationFinding[] = [];
    for (const raw of data.urls) {
      let validated: ReturnType<typeof validPublicHost>;
      try { validated = validPublicHost(raw); }
      catch (err) {
        findings.push({ url: raw, host: "—", dnsStatus: "skipped", dnsDetails: err instanceof Error ? err.message : "Invalid URL", reputationStatus: "skipped", reputationDetails: "Lookup skipped." });
        continue;
      }
      const [dns, reputation] = await Promise.all([dnsCheck(validated.host), safeBrowsingCheck(validated.url)]);
      findings.push({ url: raw, host: validated.host, ...dns, ...reputation });
    }
    return findings;
  });
