import { z } from "zod";
import { USER_LAYER_VALUES } from "@/lib/permissions/constants";
import type { UserLayer } from "@/lib/permissions/constants";

const permissionActionsSchema = z.object({
  view: z.boolean().default(false),
  add: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
  comment: z.boolean().default(false),
});

export const roleCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
  description: z.string().trim().max(500).optional().default(""),
  // Target user layer (requirement #8/#9) - immutable after creation, see
  // role-update.schema.ts, which deliberately omits this field. A
  // COMPANY_ADMIN's request always gets forced to MODERATOR server-side
  // regardless of what's submitted here - see role.service.ts#createRole.
  userLayer: z.enum(USER_LAYER_VALUES as [UserLayer, ...UserLayer[]]),
  permissions: z.record(z.string(), permissionActionsSchema).default({}),
  isActive: z.boolean().default(true),
});

export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
