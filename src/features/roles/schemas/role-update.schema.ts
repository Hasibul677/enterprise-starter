import { z } from "zod";

const permissionActionsSchema = z.object({
  view: z.boolean().default(false),
  add: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
  comment: z.boolean().default(false),
});

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  permissions: z.record(z.string(), permissionActionsSchema).optional(),
  isActive: z.boolean().optional(),
});

export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
