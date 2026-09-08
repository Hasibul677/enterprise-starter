import { z } from "zod";

export const impersonateSchema = z.object({
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id format."),
});

export type ImpersonateInput = z.infer<typeof impersonateSchema>;
