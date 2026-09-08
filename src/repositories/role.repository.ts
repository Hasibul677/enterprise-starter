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
