import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileDown,
  Link2,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { RiskGauge } from "@/components/risk-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Indicator, ThreatLevel, UrlAnalysis } from "@/lib/phishing-engine";
import { cn } from "@/lib/utils";

export interface ScanRecord {
  id: string;
  subject: string;
  sender: string | null;
  body?: string | null;
  verdict: string;
  risk_score: number;
  confidence: number;
  threat_level: string;
  indicators: unknown;
  urls: unknown;
  headers: unknown;
  iocs: unknown;
  recommendations: unknown;
  click_impact: unknown;
  ai_explanation: string | null;
  created_at: string;
}

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const URL_STATUS_STYLE: Record<string, string> = {
  safe: "text-safe border-safe/40 bg-safe/10",
  suspicious: "text-caution border-caution/40 bg-caution/10",
  dangerous: "text-warning border-warning/40 bg-warning/10",
  "high risk": "text-critical border-critical/40 bg-critical/10",
};

export function ScanResultView({
  scan,
  onDownload,
  onAskAssistant,
}: {
  scan: ScanRecord;
  onDownload?: () => void;
  onAskAssistant?: () => void;
}) {
  const phishing = scan.verdict === "phishing";
  const level = (scan.threat_level as ThreatLevel) ?? "low";
  const indicators = arr<Indicator>(scan.indicators);
  const urls = arr<UrlAnalysis>(scan.urls);
  const recommendations = arr<string>(scan.recommendations);
  const impact = arr<{ title: string; detail: string }>(scan.click_impact);
  const headers = (scan.headers ?? {}) as {
    from?: string | null;
    replyTo?: string | null;
    returnPath?: string | null;
    displayNameMismatch?: boolean;
    replyToMismatch?: boolean;
    freeMailSender?: boolean;
    notes?: string[];
  };
  const iocs = (scan.iocs ?? {}) as {
    domains?: string[];
    ips?: string[];
    emails?: string[];
    urls?: string[];
  };

  return (
    <div className="animate-rise space-y-5">
      <section
        className={cn(
          "glass-panel relative overflow-hidden rounded-2xl p-6",
          phishing ? "border-critical/40" : "border-safe/40",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            background: phishing ? "var(--gradient-threat)" : "var(--gradient-signal)",
          }}
        />
        <div className="relative grid gap-6 lg:grid-cols-[auto_1fr]">
          <RiskGauge value={scan.risk_score} level={level} />
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold",
                  phishing
                    ? "animate-threat border-critical/50 bg-critical/15 text-critical"
                    : "border-safe/50 bg-safe/15 text-safe",
                )}
              >
                {phishing ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />}
                {phishing ? "Phishing detected" : "No phishing detected"}
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {Math.round(scan.confidence)}% heuristic confidence
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {indicators.length} indicator{indicators.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {urls.length} URL{urls.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="truncate text-lg font-medium">{scan.subject || "(no subject)"}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {scan.sender || "sender not supplied"} ·{" "}
                {new Date(scan.created_at).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Heuristic confidence</span>
                <span className="font-mono">{Math.round(scan.confidence)}%</span>
              </div>
              <Progress value={scan.confidence} className="h-1.5" />
            </div>

            <div className="flex flex-wrap gap-2">
              {onDownload && (
                <Button size="sm" variant="outline" onClick={onDownload}>
                  <FileDown className="size-4" />
                  PDF report
                </Button>
              )}
              {onAskAssistant && (
                <Button size="sm" variant="outline" onClick={onAskAssistant}>
                  <Sparkles className="size-4" />
                  Ask the assistant
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <RiskExplanationDashboard
        riskScore={scan.risk_score}
        confidence={scan.confidence}
        level={level}
        indicators={indicators}
        urls={urls}
      />

      <Tabs defaultValue="explanation">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="explanation">AI explanation</TabsTrigger>
          <TabsTrigger value="indicators">Indicators</TabsTrigger>
          <TabsTrigger value="urls">URLs</TabsTrigger>
          <TabsTrigger value="headers">Headers &amp; IOCs</TabsTrigger>
          <TabsTrigger value="impact">Impact &amp; actions</TabsTrigger>
        </TabsList>

        <TabsContent value="explanation" className="mt-4">
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              Explainable AI analysis
            </h3>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {(scan.ai_explanation ?? "No explanation stored.")
                .split(/\n{2,}/)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="indicators" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {indicators.length === 0 && (
              <div className="glass-panel col-span-full flex items-center gap-3 rounded-2xl p-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-5 text-safe" />
                No phishing heuristics fired against this message.
              </div>
            )}
            {indicators.map((indicator, index) => (
              <article
                key={`${indicator.id}-${index}`}
                className="glass-panel rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle
                      className={cn(
                        "size-4",
                        indicator.weight >= 20
                          ? "text-critical"
                          : indicator.weight >= 12
                            ? "text-warning"
                            : "text-caution",
                      )}
                    />
                    {indicator.title}
                  </h4>
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase">
                    {indicator.category} · +{indicator.weight}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{indicator.detail}</p>
                {indicator.evidence && (
                  <p className="mt-3 truncate rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-foreground">
                    “{indicator.evidence}”
                  </p>
                )}
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="urls" className="mt-4">
          <div className="space-y-3">
            {urls.length === 0 && (
              <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">
                No links were found in this message.
              </div>
            )}
            {urls.map((url, index) => (
              <article key={`${url.url}-${index}`} className="glass-panel rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 break-all font-mono text-sm">
                      <Link2 className="size-4 shrink-0 text-muted-foreground" />
                      {url.url}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {url.domain} · {url.https ? "HTTPS" : "HTTP"} · {url.length} chars ·{" "}
                      {url.subdomainCount} subdomain{url.subdomainCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 uppercase", URL_STATUS_STYLE[url.status])}
                  >
                    {url.status} · {url.riskScore}
                  </Badge>
                </div>
                {url.reasons.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
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
        </TabsContent>

        <TabsContent value="headers" className="mt-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="glass-panel rounded-2xl p-5">
              <h4 className="text-sm font-semibold">Sender forensics</h4>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="From" value={headers.from ?? "—"} />
                <Row label="Reply-To" value={headers.replyTo ?? "—"} />
                <Row label="Return-Path" value={headers.returnPath ?? "—"} />
                <Row
                  label="Display-name spoof"
                  value={headers.displayNameMismatch ? "Detected" : "Not detected"}
                  danger={headers.displayNameMismatch}
                />
                <Row
                  label="Reply-To mismatch"
                  value={headers.replyToMismatch ? "Detected" : "Not detected"}
                  danger={headers.replyToMismatch}
                />
                <Row
                  label="Free-mail sender"
                  value={headers.freeMailSender ? "Yes" : "No"}
                  danger={headers.freeMailSender}
                />
              </dl>
              {(headers.notes?.length ?? 0) > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                  {headers.notes?.map((note) => (
                    <li key={note} className="text-sm text-muted-foreground">
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Indicators of compromise</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(iocs, null, 2));
                    toast.success("IOCs copied to clipboard");
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </div>
              <IocGroup label="Domains" items={iocs.domains ?? []} />
              <IocGroup label="IP addresses" items={iocs.ips ?? []} />
              <IocGroup label="Email addresses" items={iocs.emails ?? []} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="impact" className="mt-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="glass-panel rounded-2xl p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquareWarning className="size-4 text-warning" />
                What happens if the link is clicked
              </h4>
              <div className="mt-3 space-y-3">
                {impact.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No high-impact click consequences were modelled for this message.
                  </p>
                )}
                {impact.map((item) => (
                  <div key={item.title} className="rounded-xl border border-border/60 p-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-safe" />
                Recommended actions
              </h4>
              <ol className="mt-3 space-y-2.5">
                {recommendations.map((rec, index) => (
                  <li key={rec} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] text-primary">
                      {index + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


/** This panel presents stored evidence without recalculating or changing the server verdict. */
function RiskExplanationDashboard({
  riskScore,
  confidence,
  level,
  indicators,
  urls,
}: {
  riskScore: number;
  confidence: number;
  level: ThreatLevel;
  indicators: Indicator[];
  urls: UrlAnalysis[];
}) {
  const categories: { key: Indicator["category"]; label: string }[] = [
    { key: "credentials", label: "Credential requests" },
    { key: "sender", label: "Sender anomalies" },
    { key: "url", label: "Suspicious links" },
    { key: "urgency", label: "Pressure & urgency" },
    { key: "social", label: "Social engineering" },
    { key: "content", label: "Message content" },
    { key: "attachment", label: "Attachment cues" },
  ];
  const groups = categories
    .map(({ key, label }) => ({
      key,
      label,
      count: indicators.filter((item) => item.category === key).length,
      weight: indicators
        .filter((item) => item.category === key)
        .reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.weight - a.weight);
  const maxWeight = Math.max(1, ...groups.map((group) => group.weight));
  const strongestSignals = [...indicators]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
  const riskyLinks = urls.filter((url) => url.riskScore >= 50).length;
  const score = Math.max(0, Math.min(100, Number(riskScore) || 0));
  const confidenceValue = Math.max(0, Math.min(100, Number(confidence) || 0));
  const riskMessage =
    level === "critical"
      ? "Critical warning signs found. Avoid links and attachments until independently verified."
      : level === "high"
        ? "Multiple or significant warning signs found. Treat the message as suspicious."
        : level === "medium"
          ? "Some warning signs were detected. Confirm the sender through a trusted channel."
          : "Few warning signs were detected by these checks. This does not prove the email is safe.";

  return (
    <section className="glass-panel rounded-2xl p-5 md:p-6" aria-label="Risk score explanation dashboard">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="size-4 text-primary" />
            Risk explanation dashboard
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Why this email received its risk assessment</p>
        </div>
        <Badge variant="outline" className="font-mono uppercase">{level} threat · {Math.round(score)}/100</Badge>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Heuristic risk score</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{Math.round(score)}<span className="text-sm text-muted-foreground"> / 100</span></p>
          <Progress value={score} className="mt-3 h-2" />
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Triggered warning signs</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{indicators.length}</p>
          <p className="mt-2 text-xs text-muted-foreground">Across {groups.length} detection categories</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">Links needing closer review</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{riskyLinks}<span className="text-sm text-muted-foreground"> / {urls.length}</span></p>
          <p className="mt-2 text-xs text-muted-foreground">Based on structural URL checks only</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">{riskMessage}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold">Triggered signal categories</h4>
          <p className="mt-1 text-xs text-muted-foreground">Relative indicator weights, not percentages of total risk</p>
          {groups.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No rule-based indicators triggered in this scan.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span>{group.label} <span className="text-muted-foreground">({group.count})</span></span>
                    <span className="font-mono text-muted-foreground">{group.weight} signal pts</span>
                  </div>
                  <Progress value={(group.weight / maxWeight) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold">Strongest evidence</h4>
          {strongestSignals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No suspicious patterns matched. Attack methods outside these rules may still be missed.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {strongestSignals.map((indicator, index) => (
                <li key={`${indicator.id}-${index}`} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start gap-2 text-sm font-medium">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    {indicator.title}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{indicator.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-5 flex items-start gap-2 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          The risk score and {Math.round(confidenceValue)}% confidence estimate come from the app’s rule-based engine.
          They are not statistically calibrated probabilities or proof of malicious activity.
          Signal weights can overlap, and link reputation checks are separate from this score.
          Check the Indicators and AI explanation tabs for more detail.
        </span>
      </div>
    </section>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate text-right font-mono text-xs",
          danger ? "text-critical" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function IocGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">None</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {items.slice(0, 24).map((item) => (
            <span
              key={item}
              className="break-all rounded-md bg-muted/70 px-2 py-1 font-mono text-[11px]"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
