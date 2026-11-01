import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link2, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
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
      { title: "URL Analysis — PhishGuard AI" },
      {
        name: "description",
        content:
          "Inspect links for IP hosts, shorteners, punycode, brand impersonation and suspicious TLDs before anyone clicks them.",
      },
      { property: "og:title", content: "URL Analysis — PhishGuard AI" },
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

const SAMPLE = `https://login.microsoftonline.com/common/oauth2
http://192.168.44.7/paypal/secure-login/verify.php
https://bit.ly/3xPayNow
https://amaz0n-account-verify.top/signin?next=/billing`;

function UrlAnalysisPage() {
  const [input, setInput] = useState("");

  const results = useMemo<UrlAnalysis[]>(() => {
    if (!input.trim()) return [];
    const found = extractUrls(input);
    const manual = input
      .split(/[\s,]+/)
      .filter((token) => /^[a-z][a-z0-9+.-]*:\/\//i.test(token) || /^www\./i.test(token));
    const unique = Array.from(new Set([...found, ...manual]));
    return unique.map(analyzeUrl);
  }, [input]);

  const worst = results.reduce((max, r) => Math.max(max, r.riskScore), 0);

  return (
    <AppShell
      title="URL Analysis"
      description="Paste one or many links — structural forensics run instantly in your browser."
      actions={
        results.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setInput("")}>
            <Trash2 className="size-4" />
            Clear
          </Button>
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
