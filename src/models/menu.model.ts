import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { MENU_SCOPE_VALUES } from "@/lib/permissions/constants";

export const MAX_MENU_DEPTH = 3;

const menuSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Stable, globally-unique programmatic identifier (e.g. referenced by
    // future code/config) - distinct from `slug`, which only needs to be
    // unique among siblings and may change if the item is reparented.
    key: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    route: { type: String, default: null },
    icon: { type: String, default: null },
    parentId: { type: Schema.Types.ObjectId, ref: "Menu", default: null, index: true },
    level: { type: Number, required: true, min: 1, max: MAX_MENU_DEPTH },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isVisible: { type: Boolean, default: true },
    // Which permission resource gates visibility of this menu item (requires `view`).
    resourceKey: { type: String, default: null },
    // Which dashboard tree this menu belongs to (requirement #7). Only null
    // for the handful of rows that live outside the Menu admin UI entirely
    // (e.g. the customer "Dashboard" link seeded directly by seed.ts).
    scope: { type: String, enum: [...MENU_SCOPE_VALUES, null], default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

menuSchema.index({ parentId: 1, sortOrder: 1 });
menuSchema.index({ slug: 1, parentId: 1 }, { unique: true });

export type MenuDocument = InferSchemaType<typeof menuSchema> & { _id: Schema.Types.ObjectId };
export const MenuModel: Model<MenuDocument> = models.Menu || model<MenuDocument>("Menu", menuSchema);
