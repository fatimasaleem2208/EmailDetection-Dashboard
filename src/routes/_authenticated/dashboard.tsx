import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowUpRight,
  Loader2,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/scans.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Threat Dashboard — PhishGuard AI" },
      {
        name: "description",
        content:
          "Live phishing detection metrics: scan volume, threat distribution, risk trends and recent security activity.",
      },
      { property: "og:title", content: "Threat Dashboard — PhishGuard AI" },
      {
        property: "og:description",
        content: "Monitor phishing detections, risk trends and security activity in one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const LEVEL_COLORS: Record<string, string> = {
  low: "var(--safe)",
  medium: "var(--caution)",
  high: "var(--warning)",
  critical: "var(--critical)",
};

function DashboardPage() {
  const fetchDashboard = useServerFn(getDashboardData);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const scans = useMemo(() => data?.scans ?? [], [data]);

  const stats = useMemo(() => {
    const total = scans.length;
    const phishing = scans.filter((s) => s.verdict === "phishing").length;
    const critical = scans.filter((s) => s.threat_level === "critical").length;
    const avgRisk = total
      ? Math.round(scans.reduce((sum, s) => sum + s.risk_score, 0) / total)
      : 0;
    return { total, phishing, safe: total - phishing, critical, avgRisk };
  }, [scans]);

  const trend = useMemo(() => {
    const days: { day: string; phishing: number; safe: number; risk: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const inDay = scans.filter((s) => {
        const t = new Date(s.created_at).getTime();
        return t >= date.getTime() && t < next.getTime();
      });
      days.push({
        day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        phishing: inDay.filter((s) => s.verdict === "phishing").length,
        safe: inDay.filter((s) => s.verdict !== "phishing").length,
        risk: inDay.length
          ? Math.round(inDay.reduce((sum, s) => sum + s.risk_score, 0) / inDay.length)
          : 0,
      });
    }
    return days;
  }, [scans]);

  const distribution = useMemo(
    () =>
      (["low", "medium", "high", "critical"] as const).map((level) => ({
        name: level[0]!.toUpperCase() + level.slice(1),
        value: scans.filter((s) => s.threat_level === level).length,
        color: LEVEL_COLORS[level]!,
      })),
    [scans],
  );

  const riskBuckets = useMemo(() => {
    const buckets = [
      { name: "0-20", min: 0, max: 20 },
      { name: "21-40", min: 21, max: 40 },
      { name: "41-60", min: 41, max: 60 },
      { name: "61-80", min: 61, max: 80 },
      { name: "81-100", min: 81, max: 100 },
    ];
    return buckets.map((b) => ({
      name: b.name,
      count: scans.filter((s) => s.risk_score >= b.min && s.risk_score <= b.max).length,
    }));
  }, [scans]);

  return (
    <AppShell
      title="Threat Dashboard"
      description="Detection posture across every message you've analyzed."
      actions={
        <Button asChild size="sm">
          <Link to="/scanner">
            <ScanSearch className="size-4" />
            New scan
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total scans"
              value={stats.total}
              icon={Activity}
              tone="primary"
              hint="Messages analyzed"
            />
            <StatCard
              label="Phishing blocked"
              value={stats.phishing}
              icon={ShieldAlert}
              tone="critical"
              hint={
                stats.total
                  ? `${Math.round((stats.phishing / stats.total) * 100)}% of all scans`
                  : "No scans yet"
              }
            />
            <StatCard
              label="Clean messages"
              value={stats.safe}
              icon={ShieldCheck}
              tone="safe"
              hint="Verified as legitimate"
            />
            <StatCard
              label="Average risk"
              value={stats.avgRisk}
              icon={TrendingUp}
              tone="caution"
              hint={`${stats.critical} critical detection${stats.critical === 1 ? "" : "s"}`}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <div className="glass-panel rounded-2xl p-5">
              <header className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Detection trend</h2>
                  <p className="text-xs text-muted-foreground">Last 14 days of scan activity</p>
                </div>
              </header>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="phish" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--critical)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--critical)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="clean" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--safe)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="var(--safe)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="phishing"
                      name="Phishing"
                      stroke="var(--critical)"
                      fill="url(#phish)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="safe"
                      name="Legitimate"
                      stroke="var(--safe)"
                      fill="url(#clean)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-sm font-semibold">Threat level split</h2>
              <p className="text-xs text-muted-foreground">Across all stored scans</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={86}
                      paddingAngle={3}
                      stroke="var(--background)"
                    >
                      {distribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <div className="glass-panel rounded-2xl p-5">
              <h2 className="text-sm font-semibold">Risk score distribution</h2>
              <p className="text-xs text-muted-foreground">How your messages score</p>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Bar dataKey="count" name="Scans" radius={[6, 6, 0, 0]}>
                      {riskBuckets.map((bucket, index) => (
                        <Cell
                          key={bucket.name}
                          fill={
                            index >= 4
                              ? "var(--critical)"
                              : index === 3
                                ? "var(--warning)"
                                : index === 2
                                  ? "var(--caution)"
                                  : "var(--safe)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Recent detections</h2>
                  <p className="text-xs text-muted-foreground">Latest analyzed messages</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/history">
                    View all
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </header>
              <div className="mt-3 divide-y divide-border/60">
                {scans.slice(0, 6).map((scan) => (
                  <div key={scan.id} className="flex items-center gap-3 py-3">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: LEVEL_COLORS[scan.threat_level] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {scan.subject || "(no subject)"}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {scan.sender || "unknown sender"} ·{" "}
                        {new Date(scan.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-mono text-[10px] uppercase",
                        scan.verdict === "phishing"
                          ? "border-critical/40 bg-critical/10 text-critical"
                          : "border-safe/40 bg-safe/10 text-safe",
                      )}
                    >
                      {scan.risk_score}
                    </Badge>
                  </div>
                ))}
                {scans.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No scans yet — run your first analysis from the scanner.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-5">
            <h2 className="text-sm font-semibold">Security activity log</h2>
            <p className="text-xs text-muted-foreground">Audit trail for your account</p>
            <div className="mt-3 space-y-2">
              {(data?.logs ?? []).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl border border-border/50 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      log.severity === "critical"
                        ? "bg-critical"
                        : log.severity === "warning"
                          ? "bg-warning"
                          : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{log.detail || log.action}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {log.action} · {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(data?.logs ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing logged yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "critical" | "safe" | "caution";
  hint: string;
}) {
  const toneClass = {
    primary: "text-primary bg-primary/12",
    critical: "text-critical bg-critical/12",
    safe: "text-safe bg-safe/12",
    caution: "text-caution bg-caution/12",
  }[tone];

  return (
    <article className="glass-panel animate-rise rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <span className={cn("flex size-9 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}
