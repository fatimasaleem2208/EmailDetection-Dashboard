import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getActivityLogs } from "@/lib/scans.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — PhishGuard AI" },
      {
        name: "description",
        content: "A chronological audit trail of scans, deletions and account changes.",
      },
      { property: "og:title", content: "Activity Log — PhishGuard AI" },
      {
        property: "og:description",
        content: "Audit every security-relevant action on your PhishGuard AI account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const fetchLogs = useServerFn(getActivityLogs);
  const { data = [], isLoading } = useQuery({ queryKey: ["activity"], queryFn: () => fetchLogs() });

  return (
    <AppShell title="Activity Log" description="Every security-relevant event on your account.">
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : data.length === 0 ? (
        <div className="glass-panel flex h-56 flex-col items-center justify-center rounded-2xl text-center">
          <Activity className="size-8 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">No activity recorded yet</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-5">
          <ol className="relative space-y-4 border-l border-border/60 pl-6">
            {data.map((log) => (
              <li key={log.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[27px] top-1.5 size-2.5 rounded-full ring-4 ring-background",
                    log.severity === "critical"
                      ? "bg-critical"
                      : log.severity === "warning"
                        ? "bg-warning"
                        : "bg-primary",
                  )}
                />
                <p className="text-sm">{log.detail || log.action}</p>
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {log.action} · {new Date(log.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </AppShell>
  );
}
