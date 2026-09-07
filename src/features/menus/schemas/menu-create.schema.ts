import { z } from "zod";

export const menuCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/, "Key may only contain lowercase letters, numbers, hyphens, and underscores."),
  label: z.string().trim().min(1).max(100),
  slug: z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z0-9-]+$/),
  route: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().max(100).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isVisible: z.boolean().default(true),
  resourceKey: z.string().trim().max(100).nullable().optional(),
});

export type MenuCreateInput = z.infer<typeof menuCreateSchema>;
