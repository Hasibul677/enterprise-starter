import { AuditLogModel } from "@/models/audit-log.model";

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
};
