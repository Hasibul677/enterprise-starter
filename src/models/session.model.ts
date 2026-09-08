import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: String, required: true, unique: true },
    // We never store the raw refresh token - only a hash of its identifier (jti),
    // so a DB leak alone cannot be used to mint valid refresh tokens.
    refreshTokenHash: { type: String, required: true, select: false },
    refreshJti: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
    lastUsedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    // Set only for an impersonation session (requirement #21): the SUPER_ADMIN
    // userId that initiated it. `userId` above stays the IMPERSONATED target -
    // every authorization decision keys off `userId`, never this field, which
    // exists purely to survive refresh rotation (session-service.ts) and to
    // know who to restore on "Return to Super Admin".
    impersonatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

export type SessionDocument = InferSchemaType<typeof sessionSchema> & { _id: Schema.Types.ObjectId };
export const SessionModel: Model<SessionDocument> =
  models.Session || model<SessionDocument>("Session", sessionSchema);
