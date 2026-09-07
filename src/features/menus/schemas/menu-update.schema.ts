import { z } from "zod";

export const menuUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  label: z.string().trim().min(1).max(100).optional(),
  route: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().max(100).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  resourceKey: z.string().trim().max(100).nullable().optional(),
});

export type MenuUpdateInput = z.infer<typeof menuUpdateSchema>;
