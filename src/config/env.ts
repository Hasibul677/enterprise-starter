import { z } from "zod";

/**
 * Server-side environment validation.
 * This file must NEVER be imported from client components.
 * Fails fast at startup if required secrets are missing/invalid.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  ACCESS_TOKEN_SECRET: z.string().min(32, "ACCESS_TOKEN_SECRET must be at least 32 chars"),
  REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 chars"),

  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),

  ACCESS_TOKEN_EXPIRES_IN: z.string().default("30m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("45m"),

  SUPER_ADMIN_EMAIL: z.string().email(),
  SUPER_ADMIN_PASSWORD: z.string().min(8),

  NEXT_PUBLIC_APP_NAME: z.string().default("Enterprise Starter"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Lazily validated + memoized environment accessor.
 * Call getEnv() instead of reading process.env directly anywhere on the server.
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail loudly and early. Never leak this to the client - this only ever
    // runs server-side (build time / server start / route handler cold start).
    const formatted = parsed.error.flatten().fieldErrors;
    console.error("Invalid environment variables:", formatted);
    throw new Error(
      "Invalid environment variables. Check the server logs for details."
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
