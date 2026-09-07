import { z } from "zod";

const permissionActionsSchema = z.object({
  view: z.boolean().default(false),
  add: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
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
  permissions: z.record(z.string(), permissionActionsSchema).default({}),
  isActive: z.boolean().default(true),
});

export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
