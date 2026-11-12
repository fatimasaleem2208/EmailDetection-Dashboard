import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  FileDown,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Star,
  Pencil,
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
import { deleteSecurityScan, listSecurityScans } from "@/lib/security-history.functions";
import { downloadCsv, downloadScanReport } from "@/lib/pdf-report";
import { downloadSecurityReport } from "@/lib/security-pdf-report";
import { listScanOrganization, saveScanOrganization } from "@/lib/scan-organization.functions";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Scan History — EmailDetection" },
      {
        name: "description",
        content:
          "Search, review, export and delete every phishing scan you've run, with full indicator and URL breakdowns.",
      },
      { property: "og:title", content: "Scan History — EmailDetection" },
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
  const fetchSecurityHistory = useServerFn(listSecurityScans);
  const removeSecurityHistory = useServerFn(deleteSecurityScan);
  const { data: securityRows = [], isLoading: securityLoading, isError: securityError, error: securityLoadError } = useQuery({
    queryKey: ["security-history"], queryFn: () => fetchSecurityHistory(),
  });
  const [pendingSecurityDelete, setPendingSecurityDelete] = useState<string | null>(null);
  const removeSecurity = useMutation({
    mutationFn: (id: string) => removeSecurityHistory({ data: { id } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["security-history"] }); setPendingSecurityDelete(null); toast.success("History entry deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const listOrganization = useServerFn(listScanOrganization);
  const saveOrganization = useServerFn(saveScanOrganization);
  const { data: organized = [], isError: orgError } = useQuery({
    queryKey: ["scan-organization"], queryFn: () => listOrganization(),
  });
  const organizationById = useMemo(
    () => new Map(organized.map((o) => [`${o.scan_type}:${o.scan_id}`, o])),
    [organized],
  );
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string; type: "email" | "url" | "attachment" } | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNote, setEditNote] = useState("");
  const editEntry = (id: string, type: "email" | "url" | "attachment") => {
    const old = organizationById.get(`${type}:${id}`);
    setEditing({ id, type }); setEditLabel(old?.label ?? ""); setEditNote(old?.note ?? "");
  };
  const saveMeta = useMutation({
    mutationFn: (payload: { scanId: string; scanType: "email" | "url" | "attachment"; starred: boolean; label: string; note: string }) =>
      saveOrganization({ data: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scan-organization"] });
      setEditing(null); toast.success("Saved scan organization");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleStar = (id: string, type: "email" | "url" | "attachment") => {
    const old = organizationById.get(`${type}:${id}`);
    saveMeta.mutate({ scanId: id, scanType: type, starred: !old?.starred,
      label: old?.label ?? "", note: old?.note ?? "" });
  };

  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [pendingDelete, setPendingDelete] = useState<ScanRecord | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ScanRecord | null>(null);

  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scans", filter, page],
    queryFn: () => fetchScans({ data: { verdict: filter, limit: pageSize + 1, offset: page * pageSize } }),
  });

  const hasNextPage = data.length > pageSize;
  const currentPage = useMemo(() => (data as ScanRecord[]).slice(0, pageSize), [data]);

  const rows = useMemo(
    () =>
      currentPage.filter((row) => {
        const meta = organizationById.get(`email:${row.id}`);
        if (favoritesOnly && !meta?.starred) return false;
        return !search.trim() || `${row.subject} ${row.sender ?? ""} ${meta?.label ?? ""} ${meta?.note ?? ""}`.toLowerCase().includes(search.toLowerCase());
      }),
    [currentPage, search, favoritesOnly, organizationById],
  );

  const remove = useMutation({
    mutationFn: async (id: string) => removeScan({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelected(null);
      setPendingDelete(null);
      if (currentPage.length === 1 && page > 0) setPage((p) => p - 1);
      toast.success("Scan deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reopenInScanner = (scan: ScanRecord) => {
    try {
      localStorage.setItem("emaildetection-scanner-draft-v1", JSON.stringify({
        subject: scan.subject ?? "",
        sender: scan.sender ?? "",
        body: scan.body ?? "",
        source: "manual",
        useAi: true,
        result: scan,
      }));
      navigate({ to: "/scanner" });
    } catch {
      toast.error("Unable to reopen this scan in browser storage.");
    }
  };

  return (
    <AppShell
      title="Scan History"
      description="Saved email, URL and attachment analyses in your Supabase account"
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
      <section className="glass-panel rounded-2xl p-5 mb-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">URL & Attachment History</h2>
          <p className="text-xs text-muted-foreground">Up to 100 latest saved scans, separate from your existing email scans. Attachment file contents are not stored.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={favoritesOnly ? "default" : "outline"} onClick={() => setFavoritesOnly(!favoritesOnly)}>
            <Star className="size-4" /> {favoritesOnly ? "Showing starred" : "Starred only"}
          </Button>
          {orgError && <p role="alert" className="text-sm text-destructive">Could not load bookmarks. Run the scan organization SQL migration.</p>}
        </div>
        {securityLoading ? <p className="text-sm">Loading saved scans…</p> : securityError ? (
          <p role="alert" className="text-sm text-destructive">{securityLoadError instanceof Error ? securityLoadError.message : "Unable to load security history"}</p>
        ) : securityRows.length === 0 ? <p className="text-sm text-muted-foreground">No URL or attachment scans saved yet. Use “Save to History” in URL Analysis or analyze a new attachment.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="border-b border-border"><th className="py-2">Type</th><th>Target</th><th>Risk</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>{securityRows.filter((entry) => !favoritesOnly || organizationById.get(`${entry.scan_type}:${entry.id}`)?.starred).map((entry) => <tr key={entry.id} className="border-b border-border/50">
              <td className="py-3 capitalize">{entry.scan_type}</td>
              <td className="max-w-[240px] text-xs"><p className="truncate font-mono" title={entry.target}>{entry.target}</p>{organizationById.get(`${entry.scan_type}:${entry.id}`)?.label && <p className="text-primary">{organizationById.get(`${entry.scan_type}:${entry.id}`)?.label}</p>}</td>
              <td className="capitalize">{entry.risk_level}{entry.risk_score === null ? "" : ` (${entry.risk_score}/100)`}</td>
              <td className="text-xs">{new Date(entry.created_at).toLocaleString()}</td>
              <td className="space-x-2 whitespace-nowrap"><Button size="sm" variant="ghost" title="Toggle bookmark" aria-label="Toggle bookmark" onClick={() => toggleStar(entry.id, entry.scan_type)}><Star className={organizationById.get(`${entry.scan_type}:${entry.id}`)?.starred ? "size-4 fill-current text-amber-500" : "size-4"} /></Button><Button size="sm" variant="outline" onClick={() => editEntry(entry.id, entry.scan_type)}>Organize</Button><Button size="sm" variant="outline" onClick={() => downloadSecurityReport(entry)}>PDF</Button><Button size="sm" variant="outline" onClick={() => {
                const list = Array.isArray(entry.findings) ? entry.findings.map(String) : [];
                toast.info(list.length ? list.join("; ").slice(0, 500) : "No warning signs recorded", { duration: 8000 });
              }}>View findings</Button><Button size="sm" variant="outline" onClick={() => setPendingSecurityDelete(entry.id)}>Delete</Button></td>
            </tr>)}</tbody>
          </table></div>
        )}
        {pendingSecurityDelete && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-3">
          <span className="text-sm">Permanently delete this URL/attachment history entry?</span>
          <Button size="sm" variant="destructive" disabled={removeSecurity.isPending} onClick={() => removeSecurity.mutate(pendingSecurityDelete)}>Confirm delete</Button>
          <Button size="sm" variant="outline" onClick={() => setPendingSecurityDelete(null)}>Cancel</Button>
        </div>}
      </section>
      <div className="space-y-4">
        <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this page by subject or sender…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "phishing", "legitimate"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => { setFilter(value); setPage(0); }}
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
        ) : isError ? (
          <div className="glass-panel flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl px-6 text-center">
            <ShieldAlert className="size-8 text-destructive" />
            <p className="text-sm font-medium">Unable to load scan history</p>
            <p className="max-w-xl text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Please check your Supabase connection and try again."}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="glass-panel flex h-56 flex-col items-center justify-center rounded-2xl text-center">
            <ShieldCheck className="size-8 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">No scans match this view</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search.trim() ? "No results on this page. Try another page or clear the search." : "Run an analysis from the scanner to build your history."}
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
                        {organizationById.get(`email:${row.id}`)?.label && <p className="text-xs text-primary">{organizationById.get(`email:${row.id}`)?.label}</p>}
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
                          <Button size="icon" variant="ghost" aria-label="Toggle bookmark" title="Toggle bookmark"
                            onClick={(e) => { e.stopPropagation(); toggleStar(row.id, "email"); }}>
                            <Star className={organizationById.get(`email:${row.id}`)?.starred ? "size-4 fill-current text-amber-500" : "size-4"} />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Organize scan" title="Edit label and note"
                            onClick={(e) => { e.stopPropagation(); editEntry(row.id, "email"); }}>
                            <Pencil className="size-4" />
                          </Button>
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
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Page {page + 1} · Up to {pageSize} scans per page. Search filters the current page.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0 || isLoading} onClick={() => { setPage((p) => p - 1); setSelected(null); }}>
              <ArrowLeft className="size-4" /> Previous
            </Button>
            <Button size="sm" variant="outline" disabled={!hasNextPage || isLoading} onClick={() => { setPage((p) => p + 1); setSelected(null); }}>
              Next <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
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
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => reopenInScanner(selected)}>
                  <RotateCcw className="size-4" /> Reopen in scanner
                </Button>
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
                  onClick={() => setPendingDelete(selected)}
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

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organize saved scan</DialogTitle>
            <DialogDescription>Keep a private label and note for this result in your Supabase account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="scan-label">Label / category</label>
            <Input id="scan-label" maxLength={80} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="e.g. Work, Banking, To review" />
            <label className="block text-sm font-medium" htmlFor="scan-note">Private note</label>
            <Textarea id="scan-note" maxLength={1000} rows={4} value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Notes for future reference" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={!editing || saveMeta.isPending} onClick={() => {
                if (!editing) return;
                const old = organizationById.get(`${editing.type}:${editing.id}`);
                saveMeta.mutate({ scanId: editing.id, scanType: editing.type,
                  starred: old?.starred ?? false, label: editLabel, note: editNote });
              }}>Save details</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved scan?</DialogTitle>
            <DialogDescription>
              This permanently deletes the selected scan from your Supabase history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm font-medium">{pendingDelete?.subject || "(no subject)"}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}>
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete scan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
