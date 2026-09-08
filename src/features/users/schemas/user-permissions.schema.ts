import { z } from "zod";

const permissionActionsSchema = z.object({
  view: z.boolean().default(false),
  add: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
  comment: z.boolean().default(false),
});

/**
 * Per-user permission-override payload (requirement #9). Shape mirrors
 * Role.permissions - see role-create.schema.ts - but every entry here is a
 * grant layered on top of the target user's role(s), scoped down to
 * whatever the actor is authorized to hand out (enforced in
 * user.service.ts#setUserPermissionOverrides, never trusted from the body
 * alone).
 */
export const userPermissionsUpdateSchema = z.object({
  permissions: z.record(z.string(), permissionActionsSchema).default({}),
});

export type UserPermissionsUpdateInput = z.infer<typeof userPermissionsUpdateSchema>;
