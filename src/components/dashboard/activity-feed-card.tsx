"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { Skeleton } from "@/components/feedback/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ForbiddenState } from "@/components/feedback/forbidden";
import { formatRelativeTime, humanizeAction } from "@/lib/dashboard/format";
import type { ActivityItem } from "@/services/dashboard.service";

/**
 * Self-contained: fetches its own `/api/dashboard/activity` (a real,
 * RBAC-scoped read over AuditLogModel - see dashboard.service.ts). Own
 * independent loading/error state, same as every other dashboard card, so
 * this never blocks or is blocked by the others.
 */
export function ActivityFeedCard() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const data = await apiClient.get<ActivityItem[]>("/api/dashboard/activity");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recent activity.");
      if (err instanceof ApiClientError) setErrorCode(err.code);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-time state sync
    load();
  }, [load]);

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-ink-soft" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-ink">Recent activity</h3>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : error ? (
        errorCode === "FORBIDDEN" ? (
          <ForbiddenState />
        ) : (
          <ErrorState message={error} onRetry={load} />
        )
      ) : items.length === 0 ? (
        <EmptyState title="No recent activity" description="Actions taken across the system will show up here." />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">
                  <span className="font-medium">{humanizeAction(item.action)}</span>{" "}
                  <span className="text-ink-soft">&middot; {item.entityLabel}</span>
                </p>
                <p className="truncate text-xs text-ink-soft">by {item.actor ? item.actor.name : "System"}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-ink-soft">
                {formatRelativeTime(item.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
