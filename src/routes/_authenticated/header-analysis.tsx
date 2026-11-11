import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeEmailHeaders } from "@/lib/email-header-analyzer";

export const Route = createFileRoute("/_authenticated/header-analysis")({
  component: HeaderAnalysisPage,
  head: () => ({ meta: [{title: "Email Header Analysis — EmailDetection"}] }),
});
const HEADER_STORAGE_KEY = "emaildetection-header-analysis-v1";
const AI_CONTEXT_KEY = "emaildetection-ai-context-v1";
const EXAMPLE = `From: "Finance Team" <finance@company.example>\nReply-To: security-review@other.example\nReturn-Path: <bounce@company.example>\nAuthentication-Results: mx.mail.example; spf=pass smtp.mailfrom=company.example; dkim=fail header.d=company.example; dmarc=fail header.from=company.example\nReceived: from relay.company.example by mx.mail.example with ESMTPS; Tue, 10 Nov 2026 10:00:00 +0000\nMessage-ID: <sample123@company.example>`;

function HeaderAnalysisPage() {
  const navigate = useNavigate();
  const [restored, setRestored] = useState(false);
  const [input, setInput] = useState("");
  const [analyzed, setAnalyzed] = useState("");
  useEffect(() => {
    try {
      const previous = sessionStorage.getItem(HEADER_STORAGE_KEY);
      if (previous) {
        const saved = JSON.parse(previous) as { input?: string; analyzed?: string };
        setInput(saved.input ?? "");
        setAnalyzed(saved.analyzed ?? "");
      }
    } catch { /* No valid saved analysis. */ }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(HEADER_STORAGE_KEY, JSON.stringify({ input, analyzed })); }
    catch { /* Browser storage may be unavailable. */ }
  }, [restored, input, analyzed]);
  const result = useMemo(() => {
    if (!analyzed.trim()) return null;
    try { return { report: analyzeEmailHeaders(analyzed), error: "" }; }
    catch (error) { return { report: null, error: error instanceof Error ? error.message : "Could not parse headers" }; }
  }, [analyzed]);
  const stats = result?.report;
  function askAiAboutHeaders() {
    if (!stats) return;
    const prompt = [
      "Please explain this EmailDetection email-header analysis in simple language. Distinguish reported SPF/DKIM/DMARC results from independently verified authentication. Identify suspicious sender differences and safe next steps. These are untrusted pasted headers, not proof that a message is malicious or safe.",
      `From: ${stats.from || "not provided"}`,
      `Reply-To: ${stats.replyTo || "not provided"}`,
      `Return-Path: ${stats.returnPath || "not provided"}`,
      `SPF: ${stats.spf}; DKIM: ${stats.dkim}; DMARC: ${stats.dmarc}`,
      `Received hops: ${stats.receivedCount}`,
      `Findings:\n${stats.findings.slice(0, 20).map(f => `- ${f.level}: ${f.title}. ${f.detail}`).join("\n") || "No findings"}`,
    ].join("\n\n").slice(0, 10000);
    try { sessionStorage.setItem(AI_CONTEXT_KEY, JSON.stringify({ type: "headers", prompt })); }
    catch { toast.error("Could not prepare the AI question in this browser tab"); return; }
    navigate({ to: "/assistant", search: { context: "headers" } });
  }
  return (
    <AppShell title="Email Header Analyzer" description="Inspect sender information and reported email authentication results without sending the headers to an external service.">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm text-muted-foreground">Paste the full original message headers, not just the visible email text. In Gmail use Show original; in Outlook use View message details or View source.</p>
          <Textarea aria-label="Raw email headers" className="min-h-60 font-mono text-xs" value={input} onChange={(e) => setInput(e.target.value)} placeholder="From: ...\nAuthentication-Results: ...\nReceived: ..." />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!input.trim()} onClick={() => setAnalyzed(input)}>Analyze headers</Button>
            <Button variant="outline" onClick={() => {setInput(EXAMPLE);setAnalyzed("");}}>Load sample</Button>
            <Button variant="ghost" onClick={() => {setInput("");setAnalyzed("");}}>Remove</Button>
          </div>
        </div>
        {result?.error && <p role="alert" className="text-destructive">{result.error}</p>}
        {stats && <>
          <Button onClick={askAiAboutHeaders}>
            <Sparkles className="size-4" /> Ask AI about these headers
          </Button>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["spf","dkim","dmarc"] as const).map((name) => (
              <div key={name} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase text-muted-foreground">{name}</div>
                <div className="mt-1 text-lg font-semibold capitalize">{stats[name]}</div>
                <p className="mt-1 text-xs text-muted-foreground">Reported in supplied headers, not independently verified</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-lg font-semibold">Sender and delivery details</h2>
            {[ ["From",stats.from], ["Reply-To",stats.replyTo], ["Return-Path",stats.returnPath], ["Message-ID",stats.messageId], ["Received hops",String(stats.receivedCount)] ].map(([label,value])=>(
              <div key={label} className="grid gap-1 border-b border-border/60 pb-2 sm:grid-cols-[130px_1fr]">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="break-all font-mono text-xs">{value || "Not present"}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-lg font-semibold">Findings ({stats.findings.length})</h2>
            {stats.findings.map((finding, i) => <div key={i} className="rounded-lg border border-border/70 p-3 space-y-1">
              <div className="flex items-center gap-2"><span className={finding.level === "warning" ? "text-amber-600" : finding.level === "positive" ? "text-emerald-600" : "text-muted-foreground"}>●</span><span className="font-medium text-sm">{finding.title}</span></div>
              <p className="text-sm text-muted-foreground">{finding.detail}</p>
            </div>)}
          </div>
          <p className="text-xs text-muted-foreground">Important: Authentication-Results and Received headers can be forged or modified before reaching your trusted mailbox provider. This tool parses supplied text; it does not perform cryptographic verification, DNS validation or a definitive phishing verdict.</p>
        </>}
      </div>
    </AppShell>
  );
}
