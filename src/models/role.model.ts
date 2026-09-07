import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { PERMISSION_ACTIONS } from "@/lib/permissions/constants";

const resourcePermissionSchema = new Schema(
  {
    view: { type: Boolean, default: false },
    add: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
  },
  { _id: false }
);

// Validates that any key added to the Map only ever contains the 4 known actions.
function validatePermissionMap(value: Map<string, Record<string, boolean>>) {
  for (const perms of value.values()) {
    const keys = Object.keys(perms);
    if (!keys.every((k) => (PERMISSION_ACTIONS as readonly string[]).includes(k))) {
      return false;
    }
  }
  return true;
}

const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    permissions: {
      type: Map,
      of: resourcePermissionSchema,
      default: {},
      validate: { validator: validatePermissionMap, message: "Invalid permission map." },
    },
    isSystem: { type: Boolean, default: false }, // system roles (super-admin, viewer) can't be deleted
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

roleSchema.index({ isActive: 1 });

export type RoleDocument = InferSchemaType<typeof roleSchema>;
export const RoleModel: Model<RoleDocument> = models.Role || model<RoleDocument>("Role", roleSchema);
