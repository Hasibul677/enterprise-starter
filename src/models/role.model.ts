import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { resourcePermissionSchema, validatePermissionMap } from "@/models/shared/resource-permission.schema";

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
    isSystem: { type: Boolean, default: false }, // the 5 fixed hierarchy roles (see ROLE_SLUGS) can't be deleted/deactivated
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

roleSchema.index({ isActive: 1 });

export type RoleDocument = InferSchemaType<typeof roleSchema>;
export const RoleModel: Model<RoleDocument> = models.Role || model<RoleDocument>("Role", roleSchema);
