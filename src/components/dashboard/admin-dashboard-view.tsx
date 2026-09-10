"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Building2, ShieldCheck, UserRound, Activity, UserPlus } from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api-client/api-client";
import { Skeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { ForbiddenState } from "@/components/feedback/forbidden";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChart, type DonutDatum } from "@/components/dashboard/donut-chart";
import { MonthlyBarChart } from "@/components/dashboard/monthly-bar-chart";
import { RecentUsersCard } from "@/components/dashboard/recent-users-card";
import { ActivityFeedCard } from "@/components/dashboard/activity-feed-card";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import type { DashboardUserStats } from "@/services/dashboard.service";
import type { UserLayer } from "@/lib/permissions/constants";

const LAYER_LABELS: Record<UserLayer, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  COMPANY_ADMIN: "Company Admin",
  MODERATOR: "Moderator",
  CUSTOMER: "Customer",
};

/** Fixed categorical order (validated: node scripts/validate_palette.js
 * "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4" --mode light --surface "#ffffff"
 * -> all checks pass) - color always follows the layer identity, never its
 * rank in whichever subset the current actor is authorized to see. */
const LAYER_COLORS: Record<UserLayer, string> = {
  SUPER_ADMIN: "#2a78d6",
  ADMIN: "#eb6834",
  COMPANY_ADMIN: "#1baf7a",
  MODERATOR: "#eda100",
  CUSTOMER: "#e87ba4",
};

function findLayerCount(stats: DashboardUserStats, layer: UserLayer): number {
  return stats.byLayer.find((l) => l.layer === layer)?.count ?? 0;
}

/**
 * `/admin` dashboard for SUPER_ADMIN/ADMIN. Owns ONE fetch of
 * `/api/dashboard/stats` (one loading/error boundary feeding the quick
 * summary, stat cards, donut, and monthly chart - they're all one API call's
 * worth of data). Recent Users, Recent Activity, and System Alerts are each
 * self-contained cards with their own independent fetch/loading/error state,
 * so a slow or broken section never blanks the rest of the page.
 */
export function AdminDashboardView() {
  const [stats, setStats] = useState<DashboardUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setErrorCode(undefined);
    try {
      const data = await apiClient.get<DashboardUserStats>("/api/dashboard/stats");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard stats.");
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
    <div className="flex flex-col gap-6">
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
      ) : error ? (
        errorCode === "FORBIDDEN" ? (
          <ForbiddenState />
        ) : (
          <ErrorState message={error} onRetry={load} />
        )
      ) : stats ? (
        <>
          <div className="rounded-lg border border-line bg-accent-soft/40 px-4 py-3 text-sm text-ink">
            <span className="font-medium">{stats.newThisMonth.toLocaleString()}</span> new user
            {stats.newThisMonth === 1 ? "" : "s"} this month &middot;{" "}
            <span className="font-medium">{stats.activeCount.toLocaleString()}</span> active of{" "}
            <span className="font-medium">{stats.totalUsers.toLocaleString()}</span> total accounts in your scope.
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total users" value={stats.totalUsers} icon={<Users className="h-4 w-4" />} tone="accent" />
            <StatCard
              label="Company Admin users"
              value={findLayerCount(stats, "COMPANY_ADMIN")}
              icon={<Building2 className="h-4 w-4" />}
              tone="accent"
            />
            <StatCard
              label="Moderator users"
              value={findLayerCount(stats, "MODERATOR")}
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="accent"
            />
            <StatCard
              label="Customer users"
              value={findLayerCount(stats, "CUSTOMER")}
              icon={<UserRound className="h-4 w-4" />}
              tone="accent"
            />
            <StatCard
              label="Active vs inactive"
              value={`${stats.activeCount.toLocaleString()} / ${stats.inactiveCount.toLocaleString()}`}
              icon={<Activity className="h-4 w-4" />}
              tone="success"
              subLabel="active / inactive"
            />
            <StatCard
              label="New this month"
              value={stats.newThisMonth}
              icon={<UserPlus className="h-4 w-4" />}
              tone="warning"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">User distribution by layer</h3>
              <DonutChart
                centerLabel="Total users"
                data={stats.byLayer.map((l): DonutDatum => ({
                  key: l.layer,
                  label: LAYER_LABELS[l.layer],
                  value: l.count,
                  color: LAYER_COLORS[l.layer],
                }))}
              />
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">Monthly registrations</h3>
              <MonthlyBarChart data={stats.monthlySeries} />
            </div>
          </div>
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentUsersCard />
        <ActivityFeedCard />
      </div>

      <AlertsPanel />
    </div>
  );
}
