import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  FileDown,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ScanResultView, type ScanRecord } from "@/components/scan-result-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteScan, listScans } from "@/lib/scans.functions";
import { downloadCsv, downloadScanReport } from "@/lib/pdf-report";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Scan History — PhishGuard AI" },
      {
        name: "description",
        content:
          "Search, review, export and delete every phishing scan you've run, with full indicator and URL breakdowns.",
      },
      { property: "og:title", content: "Scan History — PhishGuard AI" },
      {
        property: "og:description",
        content: "A searchable archive of every analyzed email and its verdict.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

type Filter = "all" | "phishing" | "legitimate";

function HistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchScans = useServerFn(listScans);
  const removeScan = useServerFn(deleteScan);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ScanRecord | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["scans", filter],
    queryFn: () => fetchScans({ data: { verdict: filter, limit: 200 } }),
  });

  const rows = useMemo(
    () =>
      (data as unknown as ScanRecord[]).filter((row) =>
        search.trim()
          ? `${row.subject} ${row.sender ?? ""}`.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [data, search],
  );

  const remove = useMutation({
    mutationFn: async (id: string) => removeScan({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setSelected(null);
      toast.success("Scan deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Scan History"
      description={`${rows.length} stored analysis result${rows.length === 1 ? "" : "s"}`}
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(rows)}
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject or sender…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "phishing", "legitimate"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
                className="capitalize"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="glass-panel flex h-56 flex-col items-center justify-center rounded-2xl text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">No scans match this view</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Run an analysis from the scanner to build your history.
            </p>
          </div>
        ) : (
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/30">
                  <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Sender</th>
                    <th className="px-4 py-3 font-medium">Verdict</th>
                    <th className="px-4 py-3 font-medium">Risk</th>
                    <th className="px-4 py-3 font-medium">Scanned</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-accent/40"
                      onClick={() => setSelected(row)}
                    >
                      <td className="max-w-[260px] px-4 py-3">
                        <p className="truncate font-medium">{row.subject || "(no subject)"}</p>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {row.sender || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1.5 text-[11px] uppercase",
                            row.verdict === "phishing"
                              ? "border-critical/40 bg-critical/10 text-critical"
                              : "border-safe/40 bg-safe/10 text-safe",
                          )}
                        >
                          {row.verdict === "phishing" ? (
                            <ShieldAlert className="size-3" />
                          ) : (
                            <ShieldCheck className="size-3" />
                          )}
                          {row.verdict}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{row.risk_score}</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${row.risk_score}%`,
                                background:
                                  row.risk_score >= 80
                                    ? "var(--critical)"
                                    : row.risk_score >= 60
                                      ? "var(--warning)"
                                      : row.risk_score >= 35
                                        ? "var(--caution)"
                                        : "var(--safe)",
                              }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Download PDF report"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadScanReport(row);
                            }}
                          >
                            <FileDown className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete scan"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove.mutate(row.id);
                            }}
                          >
                            <Trash2 className="size-4 text-critical" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">
              {selected?.subject || "(no subject)"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {selected?.sender || "sender not supplied"}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <ScanResultView
                scan={selected}
                onDownload={() => downloadScanReport(selected)}
                onAskAssistant={() =>
                  navigate({ to: "/assistant", search: { scanId: selected.id } })
                }
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: "/assistant", search: { scanId: selected.id } })}
                >
                  <Sparkles className="size-4" />
                  Discuss with AI
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remove.mutate(selected.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4 text-critical" />
                  Delete scan
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
