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
  },
  { timestamps: true }
);

export type SessionDocument = InferSchemaType<typeof sessionSchema> & { _id: Schema.Types.ObjectId };
export const SessionModel: Model<SessionDocument> =
  models.Session || model<SessionDocument>("Session", sessionSchema);
