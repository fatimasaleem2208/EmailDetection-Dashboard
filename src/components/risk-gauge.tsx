import { useEffect, useState } from "react";
import type { ThreatLevel } from "@/lib/phishing-engine";
import { cn } from "@/lib/utils";

const LEVEL_COLOR: Record<ThreatLevel, string> = {
  low: "var(--safe)",
  medium: "var(--caution)",
  high: "var(--warning)",
  critical: "var(--critical)",
};

export function RiskGauge({
  value,
  level,
  label = "Risk score",
  size = 200,
}: {
  value: number;
  level: ThreatLevel;
  label?: string;
  size?: number;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const stroke = size * 0.085;
  const radius = (size - stroke) / 2;
  // 240-degree arc gauge.
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.72;
  const dash = circumference * arcFraction;
  const progress = (animated / 100) * dash;
  const color = LEVEL_COLOR[level];

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg
        width={size}
        height={size * 0.78}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label={`${label}: ${Math.round(value)} out of 100`}
      >
        <g transform={`rotate(129 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 10px ${color})` }}
          />
        </g>
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: size * 0.24, fontWeight: 600 }}
        >
          {Math.round(animated)}
        </text>
        <text
          x="50%"
          y="61%"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: size * 0.065, letterSpacing: "0.18em" }}
        >
          {label.toUpperCase()}
        </text>
      </svg>
      <span
        className={cn(
          "-mt-1 rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
        )}
        style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        {level} threat
      </span>
    </div>
  );
}
