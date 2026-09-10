"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export type MonthlyDatum = { month: string; count: number };

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

/**
 * Trend-over-time -> one sequential hue (dataviz skill choosing-a-form.md).
 * A single series needs no legend box - the card title already says what's
 * plotted. Bars are capped at 24px, 4px rounded data-end, square at the
 * baseline (marks-and-anatomy.md); each bar is its own hover/focus target
 * showing the exact count, since only ~4-6 bars get room for a direct label.
 */
export function MonthlyBarChart({ data }: { data: MonthlyDatum[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 1);
  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div>
      <div className="mb-2 h-5 text-sm text-ink-soft">
        {active ? (
          <span>
            <span className="font-medium text-ink">{active.count.toLocaleString()}</span> registrations in{" "}
            {monthLabel(active.month)}
          </span>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
      <div className="flex h-40 items-end gap-1.5 sm:gap-2">
        {data.map((d, i) => {
          const heightPct = Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0);
          return (
            <button
              key={d.month}
              type="button"
              className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              aria-label={`${monthLabel(d.month)}: ${d.count} registrations`}
            >
              <div className="flex h-32 w-full max-w-6 items-end justify-center">
                <div
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px] bg-accent transition-opacity",
                    activeIndex === i ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className={cn("text-[11px]", activeIndex === i ? "font-medium text-ink" : "text-ink-soft")}>
                {monthLabel(d.month)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
