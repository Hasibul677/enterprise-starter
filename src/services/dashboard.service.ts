import { userRepository } from "@/repositories/user.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { buildUserListScopeFilter } from "@/services/user.service";
import { VIEWABLE_TARGET_LAYERS_BY } from "@/lib/permissions/role-hierarchy";
import { USER_LAYER_VALUES, type UserLayer } from "@/lib/permissions/constants";
import { humanizeAction } from "@/lib/dashboard/format";
import type { ResolvedAccess } from "@/lib/auth/current-user";

const MONTHS_BACK = 12;

export type DashboardUserStats = {
  totalUsers: number;
  byLayer: { layer: UserLayer; count: number }[];
  activeCount: number;
  inactiveCount: number;
  newThisMonth: number;
  monthlySeries: { month: string; count: number }[];
};

/**
 * Zero-fills the last `monthsBack` months (oldest -> newest) from a sparse
 * `{_id: "YYYY-MM", count}` aggregation result, so the monthly chart never
 * has gaps for a month with no registrations. Pure/no DB - see
 * tests/unit/dashboard-stats.test.ts.
 */
export function buildMonthlySeries(
  raw: { _id: string; count: number }[],
  monthsBack: number = MONTHS_BACK,
  now: Date = new Date()
): { month: string; count: number }[] {
  const countsByMonth = new Map(raw.map((r) => [r._id, r.count]));
  const series: { month: string; count: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    series.push({ month: key, count: countsByMonth.get(key) ?? 0 });
  }
  return series;
}

/**
 * Which layers should appear in `byLayer` for this actor - the same fixed
 * hierarchy that already gates real user data (VIEWABLE_TARGET_LAYERS_BY),
 * so a non-super-admin's stats can never structurally include a layer it
 * isn't authorized to view at all. Zero-filled for a layer with no users
 * yet, so the donut/legend is stable regardless of data.
 */
export function visibleStatsLayers(access: { isSuperAdmin: boolean; userLayer: UserLayer }): UserLayer[] {
  return access.isSuperAdmin ? USER_LAYER_VALUES : (VIEWABLE_TARGET_LAYERS_BY[access.userLayer] ?? []);
}

export async function getUserStatsSummary(access: ResolvedAccess): Promise<DashboardUserStats> {
  const scopeFilter = buildUserListScopeFilter(access);
  const monthsSince = new Date();
  monthsSince.setDate(1);
  monthsSince.setMonth(monthsSince.getMonth() - (MONTHS_BACK - 1));
  monthsSince.setHours(0, 0, 0, 0);

  const raw = await userRepository.aggregateStats(scopeFilter, monthsSince);

  const countByLayer = new Map(raw.byLayer.map((r) => [r._id, r.count]));
  const byLayer = visibleStatsLayers(access).map((layer) => ({ layer, count: countByLayer.get(layer) ?? 0 }));

  const activeCount = raw.byStatus.find((r) => r._id === "ACTIVE")?.count ?? 0;
  const inactiveCount = raw.byStatus.filter((r) => r._id !== "ACTIVE").reduce((sum, r) => sum + r.count, 0);

  return {
    totalUsers: raw.totalUsers,
    byLayer,
    activeCount,
    inactiveCount,
    newThisMonth: raw.newThisMonth,
    monthlySeries: buildMonthlySeries(raw.monthly, MONTHS_BACK),
  };
}

/**
 * "Recent Activity" and "System Alerts" are both real reads over the
 * AuditLogModel - see audit-log.repository.ts#findRecent/findRecentByActions
 * (the only place audit entries were previously readable was a `record()`
 * write, never exposed to the frontend). There is deliberately no separate
 * "alerts" collection: every alert below is a real, already-recorded audit
 * log entry whose `action` is on the fixed security-relevant list.
 */

type PopulatedUserRef = {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  userLayer: UserLayer;
} | null;

type RawAuditLogEntry = {
  _id: unknown;
  actorUserId: PopulatedUserRef;
  targetUserId: PopulatedUserRef;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
  timestamp: Date;
};

export type ActivityItem = {
  id: string;
  actor: { name: string; email: string } | null;
  action: string;
  entityType: string;
  entityLabel: string;
  timestamp: string;
};

export type AlertSeverity = "critical" | "warning" | "info";

export type SecurityAlert = {
  id: string;
  user: { name: string; email: string } | null;
  action: string;
  activity: string;
  timestamp: string;
  severity: AlertSeverity;
  /** No review/dismiss workflow is persisted anywhere - every derived alert
   * is truthfully "open" rather than faking a reviewed/dismissed history. */
  status: "open";
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Real, already-recorded action types that represent a security-relevant or
 * suspicious event, mapped to a fixed severity - both grounded in actual
 * `auditLogRepository.record()` call sites (session-service.ts,
 * user.service.ts, auth-service.ts), never invented. Anything not on this
 * list still shows in "Recent Activity" but never in "System Alerts".
 */
const SECURITY_ALERT_SEVERITY_BY_ACTION: Record<string, AlertSeverity> = {
  // A refresh token was reused/tampered with - the app's own security rules
  // treat this as a real security event, not a retryable error (see
  // session-service.ts#rotateRefreshToken / CLAUDE.md "Security rules").
  REFRESH_TOKEN_REUSE_DETECTED: "critical",
  // An account was moved to a restricted status - worth surfacing, not itself evidence of misuse.
  USER_STATUS_CHANGED_BLOCKED: "warning",
  USER_STATUS_CHANGED_DISABLED: "warning",
  // A privileged "Login as User" session was started - always worth visibility, not inherently bad.
  IMPERSONATION_STARTED: "info",
};

/** Pure - which real action types are ever alert-worthy, and at what severity. */
export function classifyAlertSeverity(action: string): AlertSeverity | null {
  return SECURITY_ALERT_SEVERITY_BY_ACTION[action] ?? null;
}

/**
 * Whether a non-super-admin actor may see this audit log entry: its own
 * actions are always visible; otherwise only entries whose ACTOR or TARGET
 * resolves to a layer inside VIEWABLE_TARGET_LAYERS_BY (the same fixed
 * hierarchy /api/users and the stats endpoint already enforce). An entry
 * with neither an in-scope actor/target (e.g. a Role/Menu change made by a
 * layer the actor can't see) is excluded rather than guessed at - the safe
 * default per "never expose unauthorized users/data through the dashboard".
 * Pure - see tests/unit/dashboard-stats.test.ts.
 */
export function isAuditLogVisibleToActor(
  entry: { actorUserId: PopulatedUserRef; targetUserId: PopulatedUserRef },
  access: { isSuperAdmin: boolean; userLayer: UserLayer; userId: string }
): boolean {
  if (access.isSuperAdmin) return true;
  if (entry.actorUserId && String(entry.actorUserId._id) === access.userId) return true;
  const visible = new Set(visibleStatsLayers(access));
  if (entry.actorUserId && visible.has(entry.actorUserId.userLayer)) return true;
  if (entry.targetUserId && visible.has(entry.targetUserId.userLayer)) return true;
  return false;
}

function refName(ref: PopulatedUserRef): { name: string; email: string } | null {
  return ref ? { name: `${ref.firstName} ${ref.lastName}`, email: ref.email } : null;
}

function resolveEntityLabel(entry: RawAuditLogEntry): string {
  if (entry.targetUserId) return `${entry.targetUserId.firstName} ${entry.targetUserId.lastName}`;
  if (entry.entityType === "User" && entry.actorUserId && entry.entityId === String(entry.actorUserId._id)) {
    return `${entry.actorUserId.firstName} ${entry.actorUserId.lastName}`;
  }
  return entry.entityId ? `${entry.entityType} #${String(entry.entityId).slice(-6)}` : entry.entityType;
}

// A non-super-admin's scope filter happens in application code (not the
// Mongo query, which has no cheap way to join+filter by a referenced user's
// layer) - so more raw candidates than `limit` are fetched to leave enough
// left after filtering. Capped so a chatty log can't make this unbounded.
const CANDIDATE_MULTIPLIER = 6;
const CANDIDATE_MAX = 150;

function candidateLimit(access: { isSuperAdmin: boolean }, limit: number): number {
  return access.isSuperAdmin ? limit : Math.min(limit * CANDIDATE_MULTIPLIER, CANDIDATE_MAX);
}

export async function getRecentActivity(access: ResolvedAccess, limit = 8): Promise<ActivityItem[]> {
  const raw = (await auditLogRepository.findRecent(candidateLimit(access, limit))) as unknown as RawAuditLogEntry[];
  const scoped = raw.filter((entry) =>
    isAuditLogVisibleToActor(entry, {
      isSuperAdmin: access.isSuperAdmin,
      userLayer: access.userLayer,
      userId: String(access.user._id),
    })
  );

  return scoped.slice(0, limit).map((entry) => ({
    id: String(entry._id),
    actor: refName(entry.actorUserId),
    action: entry.action,
    entityType: entry.entityType,
    entityLabel: resolveEntityLabel(entry),
    timestamp: entry.timestamp.toISOString(),
  }));
}

export async function getSecurityAlerts(access: ResolvedAccess, limit = 10): Promise<SecurityAlert[]> {
  const actions = Object.keys(SECURITY_ALERT_SEVERITY_BY_ACTION);
  const raw = (await auditLogRepository.findRecentByActions(
    actions,
    candidateLimit(access, limit)
  )) as unknown as RawAuditLogEntry[];
  const scoped = raw.filter((entry) =>
    isAuditLogVisibleToActor(entry, {
      isSuperAdmin: access.isSuperAdmin,
      userLayer: access.userLayer,
      userId: String(access.user._id),
    })
  );

  return scoped.slice(0, limit).map((entry) => ({
    id: String(entry._id),
    user: refName(entry.actorUserId),
    action: entry.action,
    activity: humanizeAction(entry.action),
    timestamp: entry.timestamp.toISOString(),
    severity: classifyAlertSeverity(entry.action) ?? "info",
    status: "open",
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ?? {},
  }));
}
