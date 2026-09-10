import { AuditLogModel } from "@/models/audit-log.model";

const ACTOR_TARGET_SELECT = "firstName lastName email userLayer";

export const auditLogRepository = {
  async record(entry: {
    actorUserId?: string | null;
    targetUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return AuditLogModel.create({ ...entry, timestamp: new Date() });
  },

  /**
   * Most recent `limit` entries, actor/target populated so callers (see
   * dashboard.service.ts) can both render a human label and RBAC-scope by
   * the referenced user's layer without a second round trip. Unfiltered by
   * design - which entries an actor may actually see is a scoping decision,
   * not a raw-query one, so it belongs in the service layer.
   */
  async findRecent(limit: number) {
    return AuditLogModel.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate("actorUserId", ACTOR_TARGET_SELECT)
      .populate("targetUserId", ACTOR_TARGET_SELECT)
      .lean()
      .exec();
  },

  /** Same as findRecent(), narrowed to a fixed set of action types - used for the security-alerts feed. */
  async findRecentByActions(actions: string[], limit: number) {
    return AuditLogModel.find({ action: { $in: actions } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate("actorUserId", ACTOR_TARGET_SELECT)
      .populate("targetUserId", ACTOR_TARGET_SELECT)
      .lean()
      .exec();
  },
};
