import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, RotateCcw, ScanSearch, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ScanResultView, type ScanRecord } from "@/components/scan-result-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { analyzeAndSaveScan } from "@/lib/scans.functions";
import { parseEmail } from "@/lib/eml-parser";
import { downloadScanReport } from "@/lib/pdf-report";
import { analyzeEmail } from "@/lib/phishing-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scanner")({
  head: () => ({
    meta: [
      { title: "Email Scanner — PhishGuard AI" },
      {
        name: "description",
        content:
          "Paste an email or upload an .eml file and get an instant phishing verdict with risk score, indicators and URL forensics.",
      },
      { property: "og:title", content: "Email Scanner — PhishGuard AI" },
      {
        property: "og:description",
        content: "Instant phishing verdicts with explainable AI analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScannerPage,
});

const SAMPLES = [
  {
    label: "Credential harvest",
    subject: "URGENT: Your Microsoft 365 account will be suspended in 24 hours",
    sender: "Microsoft Security <security-alert@ms-verify-account.top>",
    body: `Dear user,

We detected unusual sign-in activity on your account. Your access will be permanently suspended within 24 hours unless you verify your identity immediately.

Verify now: http://ms-verify-account.top/login/office365/verify?id=8823

Failure to confirm your password and payment details will result in permanent account closure.

Microsoft Account Team`,
  },
  {
    label: "Invoice / payment fraud",
    subject: "Re: Outstanding invoice #INV-88213 — payment overdue",
    sender: "Accounts Payable <billing@dhl-express-delivery.xyz>",
    body: `Hello,

Your payment for invoice INV-88213 has failed. Please update your bank details within 12 hours to avoid legal action.

Download the invoice: http://bit.ly/3xInvoicePay

Reply-To: recovery.finance@gmail.com

Regards,
Finance Department`,
  },
  {
    label: "Legitimate newsletter",
    subject: "Your weekly engineering digest is ready",
    sender: "Engineering Digest <newsletter@github.com>",
    body: `Hi there,

Here's what happened in your repositories this week: 12 pull requests merged, 4 issues closed and 2 releases published.

Read the full digest: https://github.com/dashboard

You can change your email preferences at any time in your account settings.`,
  },
];

function ScannerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analyze = useServerFn(analyzeAndSaveScan);
  const fileRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [source, setSource] = useState<"manual" | "upload">("manual");
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ScanRecord | null>(null);

  const preview = body.trim().length > 20 ? analyzeEmail({ subject, body, sender }) : null;

  const mutation = useMutation({
    mutationFn: async () =>
      analyze({ data: { subject, sender, body, useAi, source: source === "manual" ? "paste" : "txt" } }),
    onSuccess: (data) => {
      setResult(data.scan as unknown as ScanRecord);
      queryClient.invalidateQueries();
      toast.success(
        data.scan.verdict === "phishing"
          ? "Phishing detected — review the breakdown below."
          : "No phishing signals of significance found.",
      );
      if (!data.aiAvailable && useAi) {
        toast.warning("AI narrative unavailable — showing the engine's own explanation.");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const loadFile = async (file: File) => {
    if (file.size > 2_000_000) {
      toast.error("That file is larger than 2 MB.");
      return;
    }
    const text = await file.text();
    const parsed = parseEmail(text);
    setSubject(parsed.subject || file.name.replace(/\.[^.]+$/, ""));
    setSender(parsed.sender);
    setBody(parsed.body);
    setSource("upload");
    toast.success(`Loaded ${file.name}`);
  };

  const reset = () => {
    setSubject("");
    setSender("");
    setBody("");
    setResult(null);
    setSource("manual");
  };

  return (
    <AppShell
      title="Email Scanner"
      description="Paste a suspicious message or drop an .eml file for full-spectrum analysis."
      actions={
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-4" />
          Clear
        </Button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_1fr]">
        <form
          className="glass-panel h-fit space-y-4 rounded-2xl p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim().length < 10) {
              toast.error("Paste the email body — at least 10 characters.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="subject">Subject line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your account has been suspended"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sender">Sender (optional)</Label>
            <Input
              id="sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="Support &lt;alerts@example-verify.top&gt;"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Email body</Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {body.length.toLocaleString()} chars
              </span>
            </div>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSource("manual");
              }}
              rows={12}
              placeholder="Paste the full email content, including any links…"
              className="resize-y font-mono text-xs leading-relaxed"
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void loadFile(file);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-5 text-center transition-colors",
              dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
            )}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-5 text-muted-foreground" />
            <p className="text-sm">
              Drop an <span className="font-mono">.eml</span>, <span className="font-mono">.msg</span>{" "}
              or <span className="font-mono">.txt</span> file
            </p>
            <p className="text-xs text-muted-foreground">or click to browse — max 2 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".eml,.txt,.msg,message/rfc822,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void loadFile(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-primary" />
                AI explanation
              </p>
              <p className="text-xs text-muted-foreground">
                Adds a plain-English narrative to the verdict.
              </p>
            </div>
            <Switch checked={useAi} onCheckedChange={setUseAi} />
          </div>

          {preview && (
            <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Live pre-scan
              </p>
              <p className="mt-1 text-sm">
                Provisional risk{" "}
                <span className="font-mono font-semibold">{preview.riskScore}/100</span> ·{" "}
                {preview.indicators.length} indicator{preview.indicators.length === 1 ? "" : "s"} ·{" "}
                {preview.urls.length} URL{preview.urls.length === 1 ? "" : "s"}
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <ScanSearch className="size-4" />
                Analyze email
              </>
            )}
          </Button>

          <div className="border-t border-border/60 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Load a sample
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLES.map((sample) => (
                <Button
                  key={sample.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSubject(sample.subject);
                    setSender(sample.sender);
                    setBody(sample.body);
                    setSource("manual");
                  }}
                >
                  <FileUp className="size-3.5" />
                  {sample.label}
                </Button>
              ))}
            </div>
          </div>
        </form>

        <div className="min-w-0">
          {mutation.isPending && <ScanningPanel />}
          {!mutation.isPending && result && (
            <ScanResultView
              scan={result}
              onDownload={() => downloadScanReport(result)}
              onAskAssistant={() =>
                navigate({ to: "/assistant", search: { scanId: result.id } })
              }
            />
          )}
          {!mutation.isPending && !result && <EmptyPanel />}
        </div>
      </div>
    </AppShell>
  );
}

function ScanningPanel() {
  return (
    <div className="glass-panel relative flex h-80 flex-col items-center justify-center overflow-hidden rounded-2xl">
      <div className="grid-backdrop absolute inset-0 opacity-30" />
      <div className="animate-scanline absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/25 to-transparent" />
      <Loader2 className="relative size-8 animate-spin text-primary" />
      <p className="relative mt-4 text-sm font-medium">Running detection engine…</p>
      <p className="relative mt-1 text-xs text-muted-foreground">
        Heuristics · URL forensics · header checks · AI narrative
      </p>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="glass-panel flex h-80 flex-col items-center justify-center rounded-2xl text-center">
      <ScanSearch className="size-9 text-muted-foreground" />
      <p className="mt-4 text-sm font-medium">No analysis yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Paste an email or load a sample to see the verdict, risk gauge, indicator breakdown and URL
        forensics here.
      </p>
    </div>
  );
}
