import { MenuModel, type MenuDocument } from "@/models/menu.model";

export const menuRepository = {
  async list() {
    return MenuModel.find().sort({ level: 1, sortOrder: 1 }).lean().exec();
  },
  async findById(id: string) {
    return MenuModel.findById(id).exec();
  },
  async findChildren(parentId: string) {
    return MenuModel.find({ parentId }).lean().exec();
  },
  async create(data: Partial<MenuDocument>) {
    return MenuModel.create(data);
  },
  async updateById(id: string, data: Partial<MenuDocument>) {
    return MenuModel.findByIdAndUpdate(id, data, { new: true }).exec();
  },
  async deactivateById(id: string) {
    return MenuModel.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  },
};
