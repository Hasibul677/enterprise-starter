import { RoleModel, type RoleDocument } from "@/models/role.model";

export const roleRepository = {
  async findBySlug(slug: string) {
    return RoleModel.findOne({ slug }).exec();
  },
  async findByIds(ids: string[]) {
    return RoleModel.find({ _id: { $in: ids } }).exec();
  },
  async findBySlugs(slugs: string[]) {
    return RoleModel.find({ slug: { $in: slugs } }).exec();
  },
  async list() {
    return RoleModel.find().sort({ createdAt: -1 }).lean().exec();
  },
  /** Roles a COMPANY_ADMIN may see/assign: the shared MODERATOR-layer default(s) plus its own custom roles - never a peer's. */
  async listForModeratorLayerOwner(actorUserId: string) {
    return RoleModel.find({ userLayer: "MODERATOR", $or: [{ managedBy: null }, { managedBy: actorUserId }] })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  },
  async findByUserLayer(userLayer: string) {
    return RoleModel.find({ userLayer, isActive: true }).sort({ createdAt: -1 }).lean().exec();
  },
  /** Active-only variant of listForModeratorLayerOwner, for the "assignable roles" dropdown on a Create Moderator form. */
  async findAssignableForModeratorLayerOwner(actorUserId: string) {
    return RoleModel.find({ userLayer: "MODERATOR", isActive: true, $or: [{ managedBy: null }, { managedBy: actorUserId }] })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  },
  async findById(id: string) {
    return RoleModel.findById(id).exec();
  },
  async create(data: Partial<RoleDocument>) {
    return RoleModel.create(data);
  },
  async updateById(id: string, data: Partial<RoleDocument>) {
    return RoleModel.findByIdAndUpdate(id, data, { new: true }).exec();
  },
  async deactivateById(id: string) {
    return RoleModel.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  },
};
