"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber } from "@/lib/dashboard/format";

export type DonutDatum = { key: string; label: string; value: number; color: string };

const SIZE = 160;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The 2px surface-color gap between touching segments (marks-and-anatomy.md spacers), in arc length. */
const GAP = 3;

/**
 * Part-to-whole donut (dataviz skill: categorical color, fixed hue order per
 * caller, legend always present for >=2 series, text stays in text tokens -
 * only the swatch and the ring segment itself carry the series color).
 * Hover/focus on a segment OR its legend row highlights both and shows the
 * exact count + share, since a WARN-contrast palette needs a labeled relief
 * channel, not color alone.
 */
export function DonutChart({ data, centerLabel }: { data: DonutDatum[]; centerLabel?: string }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Each segment's start offset is derived from the running total of every
  // prior segment's share - O(n^2) but n is at most 5 (one per user layer),
  // and this keeps the computation a pure per-item derivation with no
  // mutable accumulator across the map.
  const segments = data.map((d, i) => {
    const priorValue = data.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    const share = total > 0 ? d.value / total : 0;
    const cumulative = total > 0 ? (priorValue / total) * CIRCUMFERENCE : 0;
    const dash = Math.max(share * CIRCUMFERENCE - GAP, 0);
    const offset = CIRCUMFERENCE - cumulative;
    return { ...d, share, dash, offset };
  });

  const active = segments.find((s) => s.key === activeKey);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth={STROKE} />
          {total > 0 &&
            segments.map((s) =>
              s.value === 0 ? null : (
                <circle
                  key={s.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={activeKey === s.key ? STROKE + 4 : STROKE}
                  strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                  strokeDashoffset={s.offset}
                  strokeLinecap="butt"
                  tabIndex={0}
                  role="img"
                  aria-label={`${s.label}: ${s.value} (${Math.round(s.share * 100)}%)`}
                  className="cursor-pointer outline-none transition-[stroke-width] duration-100 focus-visible:opacity-80"
                  onMouseEnter={() => setActiveKey(s.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(s.key)}
                  onBlur={() => setActiveKey(null)}
                />
              )
            )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-ink">{formatCompactNumber(active ? active.value : total)}</span>
          <span className="text-center text-[11px] leading-tight text-ink-soft">
            {active ? active.label : (centerLabel ?? "Total")}
          </span>
        </div>
      </div>
      <ul className="flex w-full max-w-[220px] flex-col gap-1.5" aria-hidden={false}>
        {segments.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onMouseEnter={() => setActiveKey(s.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(s.key)}
              onBlur={() => setActiveKey(null)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors",
                activeKey === s.key ? "bg-paper" : "hover:bg-paper/60"
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate text-ink">{s.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-soft">
                {formatCompactNumber(s.value)}
                <span className="ml-1 text-xs">({Math.round(s.share * 100)}%)</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
