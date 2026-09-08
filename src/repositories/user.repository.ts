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
    const filter: Record<string, unknown> = { ...(params.scopeFilter ?? {}) };
    if (params.search) {
      filter.$or = [
        { firstName: { $regex: params.search, $options: "i" } },
        { lastName: { $regex: params.search, $options: "i" } },
        { email: { $regex: params.search, $options: "i" } },
      ];
    }
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

  async updatePermissionOverrides(id: string, permissionOverrides: Record<string, Record<string, boolean>>) {
    return UserModel.findByIdAndUpdate(id, { permissionOverrides }, { new: true }).populate("roles").exec();
  },
};
