import { UserModel, type UserDocument } from "@/models/user.model";
import type { Types } from "mongoose";

export const userRepository = {
  async findByEmail(email: string, withPasswordHash = false) {
    const query = UserModel.findOne({ email: email.toLowerCase().trim() }).populate("roles");
    if (withPasswordHash) query.select("+passwordHash");
    return query.exec();
  },

  async findById(id: string | Types.ObjectId) {
    return UserModel.findById(id).populate("roles").exec();
  },

  async create(data: Partial<UserDocument>) {
    return UserModel.create(data);
  },

  async list(params: { page: number; limit: number; search?: string; scopeFilter?: Record<string, unknown> }) {
    // Combined via $and rather than spreading scopeFilter and then
    // assigning filter.$or directly - scopeFilter may itself use $or (e.g.
    // a COMPANY_ADMIN's combined "own moderators OR any customer" scope),
    // and a plain assignment would silently clobber it, letting a search
    // query bypass the actor's scope entirely.
    const conditions: Record<string, unknown>[] = [];
    if (params.scopeFilter) conditions.push(params.scopeFilter);
    if (params.search) {
      conditions.push({
        $or: [
          { firstName: { $regex: params.search, $options: "i" } },
          { lastName: { $regex: params.search, $options: "i" } },
          { email: { $regex: params.search, $options: "i" } },
        ],
      });
    }
    const filter: Record<string, unknown> = conditions.length > 0 ? { $and: conditions } : {};
    const skip = (params.page - 1) * params.limit;
    const [items, total] = await Promise.all([
      UserModel.find(filter).populate("roles").sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean().exec(),
      UserModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  async updateById(id: string, data: Partial<UserDocument>) {
    return UserModel.findByIdAndUpdate(id, data, { new: true }).populate("roles").exec();
  },

  async incrementTokenVersion(id: string) {
    return UserModel.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true }).exec();
  },

  async incrementPermissionVersion(id: string) {
    return UserModel.findByIdAndUpdate(id, { $inc: { permissionVersion: 1 } }, { new: true }).exec();
  },

  /** Bumps every user holding `roleId` - used when a Role's own permissions/isActive change. */
  async incrementPermissionVersionForRole(roleId: string) {
    return UserModel.updateMany({ roles: roleId }, { $inc: { permissionVersion: 1 } }).exec();
  },

  /** Bumps every user - used when a Menu's isActive/scope/resourceKey changes, since menu visibility depends on role+scope for everyone. */
  async incrementPermissionVersionForAll() {
    return UserModel.updateMany({}, { $inc: { permissionVersion: 1 } }).exec();
  },

  async updatePermissionOverrides(id: string, permissionOverrides: Record<string, Record<string, boolean>>) {
    return UserModel.findByIdAndUpdate(id, { permissionOverrides }, { new: true }).populate("roles").exec();
  },

  /**
   * One aggregation, scoped by the SAME `scopeFilter` shape `list()` already
   * takes (see user.service.ts#buildUserListScopeFilter) - dashboard.service.ts
   * shapes the raw facet buckets into typed stats. Raw here on purpose (no
   * business rules, per repository convention) - which layers/months are
   * actually meaningful for a given actor is decided in the service layer.
   */
  async aggregateStats(scopeFilter: Record<string, unknown>, monthsSince: Date) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [result] = await UserModel.aggregate([
      { $match: scopeFilter },
      {
        $facet: {
          totalUsers: [{ $count: "count" }],
          byLayer: [{ $group: { _id: "$userLayer", count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          newThisMonth: [{ $match: { createdAt: { $gte: startOfMonth } } }, { $count: "count" }],
          monthly: [
            { $match: { createdAt: { $gte: monthsSince } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]).exec();

    return {
      totalUsers: (result?.totalUsers?.[0]?.count as number | undefined) ?? 0,
      byLayer: (result?.byLayer ?? []) as { _id: string; count: number }[],
      byStatus: (result?.byStatus ?? []) as { _id: string; count: number }[],
      newThisMonth: (result?.newThisMonth?.[0]?.count as number | undefined) ?? 0,
      monthly: (result?.monthly ?? []) as { _id: string; count: number }[],
    };
  },
};
