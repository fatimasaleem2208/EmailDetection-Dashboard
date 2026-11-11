import { lookupThreatIntelligence, type ThreatIntelFinding } from "@/lib/threat-intelligence.functions";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveSecurityScan } from "@/lib/security-history.functions";
import { checkUrlReputation, type UrlReputationFinding } from "@/lib/url-reputation.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link2, ShieldAlert, ShieldCheck, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeUrl, extractUrls, type UrlAnalysis } from "@/lib/phishing-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/url-analysis")({
  head: () => ({
    meta: [
      { title: "URL Analysis — EmailDetection" },
      {
        name: "description",
        content:
          "Inspect links for IP hosts, shorteners, punycode, brand impersonation and suspicious TLDs before anyone clicks them.",
      },
      { property: "og:title", content: "URL Analysis — EmailDetection" },
      {
        property: "og:description",
        content: "Structural forensics for suspicious links, scored and explained.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UrlAnalysisPage,
});

const STATUS_STYLE: Record<string, string> = {
  safe: "text-safe border-safe/40 bg-safe/10",
  suspicious: "text-caution border-caution/40 bg-caution/10",
  dangerous: "text-warning border-warning/40 bg-warning/10",
  "high risk": "text-critical border-critical/40 bg-critical/10",
};

const URL_STORAGE_KEY = "emaildetection-url-analysis-v1";
const AI_CONTEXT_KEY = "emaildetection-ai-context-v1";

const SAMPLE = `https://login.microsoftonline.com/common/oauth2
http://192.168.44.7/paypal/secure-login/verify.php
https://bit.ly/3xPayNow
https://amaz0n-account-verify.top/signin?next=/billing`;

function UrlAnalysisPage() {
  const navigate = useNavigate();
  const saveHistory = useServerFn(saveSecurityScan);
  const [savingHistory, setSavingHistory] = useState(false);
  const [savedInput, setSavedInput] = useState("");
  const [restored, setRestored] = useState(false);
  const [input, setInput] = useState("");
  const [liveChecks, setLiveChecks] = useState<UrlReputationFinding[]>([]);
  const [checking, setChecking] = useState(false);
  const [intelByDomain, setIntelByDomain] = useState<Record<string, ThreatIntelFinding>>({});
  const [checkingDomain, setCheckingDomain] = useState<string | null>(null);
  const [checkedInput, setCheckedInput] = useState("");

  // Keep analysis visible when returning from the AI Assistant (this browser tab only).
  useEffect(() => {
    try {
      // Receive the current website URL from the Chrome extension, if provided.
      // Prefer it over any URL analysis saved earlier in this browser tab.
      const incoming = new URLSearchParams(window.location.search).get("url");
      if (incoming && incoming.length <= 2048) {
        try {
          const parsed = new URL(incoming);
          if (
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            !parsed.username &&
            !parsed.password
          ) {
            setInput(parsed.origin + parsed.pathname);
            setLiveChecks([]);
            setCheckedInput("");
            setSavedInput("");
            window.history.replaceState(window.history.state, "", window.location.pathname);
            setRestored(true);
            return;
          }
        } catch { /* Ignore an invalid incoming URL. */ }
      }
      const previous = sessionStorage.getItem(URL_STORAGE_KEY);
      if (previous) {
        const saved = JSON.parse(previous) as {
          input?: string; liveChecks?: UrlReputationFinding[]; checkedInput?: string;
        };
        setInput(saved.input ?? "");
        setLiveChecks(Array.isArray(saved.liveChecks) ? saved.liveChecks : []);
        setCheckedInput(saved.checkedInput ?? "");
      }
    } catch { /* Missing or invalid session data. */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(URL_STORAGE_KEY, JSON.stringify({ input, liveChecks, checkedInput }));
    } catch { /* Storage disabled or full. */ }
  }, [restored, input, liveChecks, checkedInput]);

  const results = useMemo<UrlAnalysis[]>(() => {
    if (!input.trim()) return [];
    const found = extractUrls(input);
    const manual = input
      .split(/[\s,]+/)
      .filter((token) => /^[a-z][a-z0-9+.-]*:\/\//i.test(token) || /^www\./i.test(token));
    const unique = Array.from(new Set([...found, ...manual]));
    return unique.map(analyzeUrl);
  }, [input]);

  const liveByUrl = new Map((checkedInput === input ? liveChecks : []).map((item) => [item.url, item]));

  async function runReputationCheck() {
    if (!results.length) return;
    setChecking(true);
    try {
      const payload = await checkUrlReputation({ data: { urls: results.slice(0, 10).map((r) => r.url) } });
      setLiveChecks(payload);
      setCheckedInput(input);
      toast.success("Domain and reputation checks completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not run reputation checks");
    } finally { setChecking(false); }
  }

  const worst = results.reduce((max, r) => Math.max(max, r.riskScore), 0);

  async function checkDomain(domain: string) {
    if (checkingDomain) return;
    setCheckingDomain(domain);
    try {
      const finding = await lookupThreatIntelligence({ data: { kind: "domain", value: domain } });
      setIntelByDomain(prev => ({ ...prev, [domain]: finding }));
    } catch {
      toast.error("Domain threat-intelligence lookup unavailable.");
    } finally { setCheckingDomain(null); }
  }

  async function saveUrlsToHistory() {
    if (!results.length || savingHistory) return;
    setSavingHistory(true);
    try {
      // Store domain/score/reasons, not full URLs with query tokens or credentials.
      for (const url of results.slice(0, 10)) {
        const intel = intelByDomain[url.domain];
        await saveHistory({ data: {
          scanType: "url",
          target: url.domain.slice(0, 500),
          riskLevel: url.riskScore >= 60 ? "high" : url.riskScore >= 30 ? "caution" : "low",
          riskScore: url.riskScore,
          findings: url.reasons.slice(0, 30),
          details: { status: url.status, dns: liveByUrl.get(url.url)?.dnsStatus ?? "not_checked", vt: intel?.state ?? "not_checked" },
        } });
      }
      setSavedInput(input);
      toast.success(`Saved ${Math.min(results.length,10)} URL scan(s) to Supabase history`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save URL scan history");
    } finally { setSavingHistory(false); }
  }

  function askAiAboutUrls() {
    if (!results.length) return;
    const lines = results.slice(0, 10).map((url, index) => {
      const live = liveByUrl.get(url.url);
      const intel = intelByDomain[url.domain];
      return [
        `${index + 1}. URL: ${url.url}`,
        `Domain: ${url.domain}. Structural status: ${url.status}; score: ${url.riskScore}/100.`,
        `Structural flags: ${url.reasons.length ? url.reasons.join("; ") : "No structural warning signs found"}.`,
        intel ? `VirusTotal domain: ${intel.state}; malicious ${intel.malicious ?? "unknown"}; suspicious ${intel.suspicious ?? "unknown"}; ${intel.details}` : "VirusTotal domain lookup has not been performed.",
        live ? `Live DNS: ${live.dnsStatus} (${live.dnsDetails}); known-threat reputation: ${live.reputationStatus} (${live.reputationDetails}).` : "Live DNS/reputation checks were not performed for this URL.",
      ].join("\n");
    });
    const prompt = [
      "Please interpret my EmailDetection URL analysis. Explain which links need attention and why, distinguish structural indicators from live reputation evidence, and recommend safe next steps. Do not claim that an unflagged URL is guaranteed safe. Do not open the links.",
      ...lines,
      results.length > 10 ? `Note: ${results.length - 10} additional links were omitted from this question.` : "",
    ].filter(Boolean).join("\n\n").slice(0, 10000);
    try { sessionStorage.setItem(AI_CONTEXT_KEY, JSON.stringify({ type: "url", prompt })); }
    catch { toast.error("Could not prepare the AI question in this browser tab"); return; }
    navigate({ to: "/assistant", search: { context: "url" } });
  }

  return (
    <AppShell
      title="URL Analysis"
      description="Inspect URL structure, then optionally check DNS and Google Safe Browsing reputation."
      actions={
        results.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={saveUrlsToHistory} disabled={savingHistory || savedInput === input}>
              {savingHistory ? "Saving…" : savedInput === input ? "Saved to History" : "Save to History"}
            </Button>
            <Button size="sm" onClick={askAiAboutUrls}>
              <Sparkles className="size-4" /> Ask AI
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setInput(""); setLiveChecks([]); setCheckedInput(""); setSavedInput(""); }}>
              <Trash2 className="size-4" /> Clear
            </Button>
          </div>
        ) : null
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="glass-panel h-fit space-y-4 rounded-2xl p-5">
          <div className="space-y-2">
            <label htmlFor="urls" className="text-sm font-medium">
              URLs or raw text
            </label>
            <Textarea
              id="urls"
              rows={10}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://example.com/login…"
              className="resize-y font-mono text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE)}>
            Load sample links
          </Button>
          {results.length > 0 && (
            <div className="space-y-2">
              <Button onClick={runReputationCheck} disabled={checking} className="w-full">
                {checking ? "Checking domains…" : `Check live reputation (${Math.min(results.length, 10)} max)`}
              </Button>
              <p className="text-xs text-muted-foreground">DNS lookup runs on the server. If configured, Google Safe Browsing also receives the URLs you submit. No suspicious website is opened. Only the first 10 links are checked. Never interpret “not flagged” as proof of safety.</p>
            </div>
          )}
          {results.length > 0 && (
            <div
              className={cn(
                "rounded-xl border p-4",
                worst >= 60
                  ? "border-critical/40 bg-critical/10"
                  : worst >= 30
                    ? "border-caution/40 bg-caution/10"
                    : "border-safe/40 bg-safe/10",
              )}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                {worst >= 60 ? (
                  <ShieldAlert className="size-4 text-critical" />
                ) : (
                  <ShieldCheck className="size-4 text-safe" />
                )}
                {results.length} link{results.length === 1 ? "" : "s"} analyzed
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Highest structural risk score: <span className="font-mono">{worst}/100</span>
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {results.length === 0 && (
            <div className="glass-panel flex h-72 flex-col items-center justify-center rounded-2xl text-center">
              <Link2 className="size-9 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium">No links analyzed yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Checks cover IP-literal hosts, URL shorteners, punycode, credential paths,
                suspicious TLDs, excessive subdomains and brand impersonation.
              </p>
            </div>
          )}
          {results.map((url, index) => (
            <article key={`${url.url}-${index}`} className="glass-panel animate-rise rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-sm">{url.url}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{url.domain}</p>
                </div>
                <Badge variant="outline" className={cn("shrink-0 uppercase", STATUS_STYLE[url.status])}>
                  {url.status} · {url.riskScore}
                </Badge>
              </div>

              <div className="mt-3 space-y-2 rounded-xl border border-border/60 p-3">
                <p className="text-sm font-semibold">Threat intelligence (domain metadata)</p>
                <p className="text-xs text-muted-foreground">Optional VirusTotal check. The domain name is shared with the provider; the full URL is not submitted. A missing record does not mean safe.</p>
                <Button size="sm" variant="outline" disabled={Boolean(checkingDomain)} onClick={() => checkDomain(url.domain)}>{checkingDomain === url.domain ? "Checking…" : "Check domain intelligence"}</Button>
                {intelByDomain[url.domain] && <div role="status" className="text-xs space-y-1">
                  <p className="font-semibold">Status: {intelByDomain[url.domain].state}</p>
                  <p>{intelByDomain[url.domain].details}</p>
                  {intelByDomain[url.domain].malicious !== null && <p>Malicious: {intelByDomain[url.domain].malicious} · Suspicious: {intelByDomain[url.domain].suspicious} · Harmless: {intelByDomain[url.domain].harmless} · Undetected: {intelByDomain[url.domain].undetected}</p>}
                </div>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Flag label="HTTPS" ok={url.https} />
                <Flag label="IP host" ok={!url.isIpAddress} />
                <Flag label="Shortener" ok={!url.isShortened} />
                <Flag label="Punycode" ok={!url.hasPunycode} />
                <Flag label="Safe TLD" ok={!url.suspiciousTld} />
                <Flag label="No @ trick" ok={!url.hasAtSymbol} />
                <Flag label="No login path" ok={!url.hasCredentialPath} />
                <Flag label="No brand spoof" ok={!url.brandImpersonation} />
              </div>

              {liveByUrl.has(url.url) && (() => {
                const live = liveByUrl.get(url.url)!;
                return (
                  <div className="mt-4 space-y-2 rounded-xl border border-border/60 p-3 text-sm">
                    <p className="font-semibold">Live domain and reputation checks</p>
                    <p><strong>DNS: {live.dnsStatus}</strong> — {live.dnsDetails}</p>
                    <p><strong>Reputation: {live.reputationStatus}</strong> — {live.reputationDetails}</p>
                    {live.reputationStatus === "flagged" && <p className="font-semibold text-critical">Known threat match: avoid opening this link.</p>}
                  </div>
                );
              })()}
              {url.reasons.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                  {url.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Flag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 text-center",
        ok ? "border-safe/30 bg-safe/8" : "border-critical/40 bg-critical/10",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 text-xs font-semibold", ok ? "text-safe" : "text-critical")}>
        {ok ? "Pass" : "Fail"}
      </p>
    </div>
  );
}
