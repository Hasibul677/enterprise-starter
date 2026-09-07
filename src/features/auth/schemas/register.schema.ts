import { z } from "zod";

/**
 * Allow-listed registration fields ONLY. Notice there is no `roles`,
 * `status`, or `isSuperAdmin` field here - even if a client sends them,
 * Zod's default `.strict()`-free parse simply never surfaces them to the
 * service layer, because registerUser()'s TS signature only accepts these
 * four fields (defense in depth: schema + typed function signature).
 */
export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
