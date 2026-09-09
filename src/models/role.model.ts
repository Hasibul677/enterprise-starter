import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { resourcePermissionSchema, validatePermissionMap } from "@/models/shared/resource-permission.schema";
import { USER_LAYER_VALUES } from "@/lib/permissions/constants";

const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    // Which fixed layer this role is assignable to (immutable after
    // creation - see role-update.schema.ts, which never accepts this
    // field). SUPER_ADMIN creates roles targeting ADMIN/COMPANY_ADMIN/
    // CUSTOMER; COMPANY_ADMIN creates roles targeting only MODERATOR.
    userLayer: { type: String, enum: USER_LAYER_VALUES, required: true, index: true },
    // Ownership for a dynamically-created role: null for a SUPER_ADMIN-
    // created (global, system or custom) role; set to the creating
    // COMPANY_ADMIN's own user id for a role they created - same idiom as
    // User.managedBy, so a peer COMPANY_ADMIN never sees/assigns it.
    managedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    permissions: {
      type: Map,
      of: resourcePermissionSchema,
      default: {},
      validate: { validator: validatePermissionMap, message: "Invalid permission map." },
    },
    isSystem: { type: Boolean, default: false }, // the 5 seeded default roles (see ROLE_SLUGS) can't be deleted/deactivated
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

roleSchema.index({ isActive: 1 });

export type RoleDocument = InferSchemaType<typeof roleSchema>;
export const RoleModel: Model<RoleDocument> = models.Role || model<RoleDocument>("Role", roleSchema);
