import { SessionModel, type SessionDocument } from "@/models/session.model";

export const sessionRepository = {
  async create(data: Partial<SessionDocument>) {
    return SessionModel.create(data);
  },
  async findBySessionId(sessionId: string) {
    return SessionModel.findOne({ sessionId }).select("+refreshTokenHash").exec();
  },
  async revoke(sessionId: string, reason: string) {
    return SessionModel.findOneAndUpdate(
      { sessionId },
      { revokedAt: new Date(), revokeReason: reason },
      { new: true }
    ).exec();
  },
  async revokeAllForUser(userId: string, reason: string) {
    return SessionModel.updateMany(
      { userId, revokedAt: null },
      { revokedAt: new Date(), revokeReason: reason }
    ).exec();
  },
  async touchLastUsed(sessionId: string) {
    return SessionModel.findOneAndUpdate({ sessionId }, { lastUsedAt: new Date() }).exec();
  },
};
