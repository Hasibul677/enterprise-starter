import { z } from "zod";
import { MENU_SCOPES } from "@/lib/permissions/constants";

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
  // Optional on update (an existing menu already has one), but never
  // clearable back to null once set - see requirement #7.
  scope: z.enum([MENU_SCOPES.SUPER_ADMIN_ADMIN, MENU_SCOPES.COMPANY_ADMIN_MODERATOR]).optional(),
});

export type MenuUpdateInput = z.infer<typeof menuUpdateSchema>;
