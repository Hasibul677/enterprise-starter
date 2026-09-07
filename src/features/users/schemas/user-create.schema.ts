import { z } from "zod";

export const userCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  roleIds: z.array(z.string().min(1)).min(1, "At least one role is required."),
  status: z.enum(["ACTIVE", "WARNING", "BLOCKED", "DISABLED"]).default("ACTIVE"),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
