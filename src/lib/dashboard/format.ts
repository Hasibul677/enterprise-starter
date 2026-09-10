import { formatDate } from "@/lib/date/dayjs";

/** 1,284 / 12.9K / 4.2M - stat-tile value formatting (marks-and-anatomy.md figures contract). */
export function formatCompactNumber(value: number): string {
  if (value < 1000) return value.toLocaleString();
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** "3m ago" / "5h ago" / "2d ago", falling back to an absolute date past a week - for activity/alert timestamps. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso, "MMM D, YYYY");
}

/** Sentence-cased, space-separated - "REFRESH_TOKEN_REUSE_DETECTED" -> "Refresh token reuse detected". Used both server-side (dashboard.service.ts, for the alerts feed's `activity` label) and client-side (activity-feed-card.tsx). */
export function humanizeAction(action: string): string {
  const words = action.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
