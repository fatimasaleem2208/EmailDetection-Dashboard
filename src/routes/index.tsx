import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, FileDown, Gauge, Link2, ScanSearch, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PhishGuard AI — Intelligent Phishing Email Detection" },
      {
        name: "description",
        content:
          "Detect phishing emails in seconds with a heuristic detection engine, URL forensics, explainable AI analysis and exportable PDF reports.",
      },
      { property: "og:title", content: "PhishGuard AI — Intelligent Phishing Email Detection" },
      {
        property: "og:description",
        content:
          "Heuristic detection, URL forensics and explainable AI in one phishing analysis console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: ScanSearch, title: "Email scanner", body: "Paste a message or drop an .eml file and get a weighted verdict with evidence." },
  { icon: Link2, title: "URL forensics", body: "IP hosts, shorteners, punycode, brand spoofing and suspicious TLDs, all scored." },
  { icon: Gauge, title: "Threat dashboard", body: "Detection trends, threat-level split and risk distribution across your scans." },
  { icon: Bot, title: "AI analyst", body: "Ask follow-up questions about any scan or phishing technique in plain English." },
  { icon: FileDown, title: "PDF reports", body: "Export a shareable analysis report with indicators, URLs and recommendations." },
  { icon: ShieldCheck, title: "Explainable AI", body: "Every verdict comes with the reasoning behind it — never a black box." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-25" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth" search={{ mode: "register" }}>
              Get started
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-24">
        <section className="py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            Threat detection console
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Catch the phishing email <span className="text-gradient-signal">before anyone clicks.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            PhishGuard AI combines a deterministic 40-rule detection engine with structural URL
            forensics and explainable AI — delivering a risk score, the evidence behind it, and the
            exact actions to take.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "register" }}>
                Start scanning free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign in to console</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="glass-panel animate-rise rounded-2xl p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <feature.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-sm font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="relative border-t border-border/60 py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        PhishGuard AI · Security operations
      </footer>
    </div>
  );
}
