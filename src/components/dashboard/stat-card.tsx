import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber } from "@/lib/dashboard/format";

export type StatCardTone = "accent" | "success" | "warning" | "danger";

const TONE_STYLES: Record<StatCardTone, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/**
 * Stat-tile contract (dataviz skill, marks-and-anatomy.md "Figures"): label
 * (sentence case, no trailing colon) + value (semibold, auto-compact number)
 * + an optional sub-label for supplementary context. `value` is pre-
 * formatted by the caller when it isn't a plain count (e.g. "68%").
 */
export function StatCard({
  label,
  value,
  icon,
  tone = "accent",
  subLabel,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  tone?: StatCardTone;
  subLabel?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
      {icon && (
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", TONE_STYLES[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-ink-soft">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-ink">
          {typeof value === "number" ? formatCompactNumber(value) : value}
        </p>
        {subLabel && <p className="mt-0.5 truncate text-xs text-ink-soft">{subLabel}</p>}
      </div>
    </div>
  );
}
