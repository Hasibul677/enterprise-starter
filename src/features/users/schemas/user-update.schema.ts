import { z } from "zod";

export const userUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  roleIds: z.array(z.string().min(1)).optional(),
  status: z.enum(["ACTIVE", "WARNING", "BLOCKED", "DISABLED"]).optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});
