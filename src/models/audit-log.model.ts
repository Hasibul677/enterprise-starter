import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const auditLogSchema = new Schema(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & { _id: Schema.Types.ObjectId };
export const AuditLogModel: Model<AuditLogDocument> =
  models.AuditLog || model<AuditLogDocument>("AuditLog", auditLogSchema);
