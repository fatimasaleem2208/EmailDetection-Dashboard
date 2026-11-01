import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary glow-ring">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            PhishGuard <span className="text-gradient-signal">AI</span>
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Threat Intelligence
          </span>
        </span>
      )}
    </span>
  );
}
