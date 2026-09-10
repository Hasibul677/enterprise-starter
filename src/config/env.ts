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

  // How many reverse proxies in front of this app are trusted to correctly
  // APPEND the real client IP to X-Forwarded-For (see rate-limit.ts
  // rateLimitKeyFromRequest()). X-Forwarded-For is otherwise entirely
  // client-controllable, so it is never trusted unless this is explicitly
  // set to match the actual deployment - default 0 means "no trusted
  // proxy configured", not "no proxy exists". Set to the exact number of
  // hops (1 for a single load balancer/reverse proxy, 2 if there's a CDN in
  // front of that, etc.) once the real deployment topology is known.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

  NEXT_PUBLIC_APP_NAME: z.string().default("Enterprise Starter"),

  // Optional "Demo Account" panel on /login (see demo-account-panel.tsx) -
  // deliberately public and deliberately optional. Point these at a
  // dedicated, low-privilege (non-Super-Admin) review account only - never
  // a real user's credentials. Leave BOTH unset to hide the panel
  // entirely; the login page works identically either way.
  //
  // Read server-side only (login/page.tsx) and passed down as a prop,
  // rather than referenced as `process.env.NEXT_PUBLIC_*` inside a "use
  // client" file - keeps the value out of the long-lived static client JS
  // chunk, only in the per-request page render.
  //
  // LOCAL DEV GOTCHA (does not affect Vercel/production - see below): if
  // NEXT_PUBLIC_DEMO_PASSWORD is set in a local .env file and contains a
  // literal "$" followed by digits (e.g. "Example$77secret!"), `@next/env`'s
  // dotenv-expand step treats it as a reference to another variable (here,
  // one literally named "77") and silently drops it - confirmed
  // "Example$77secret!" loads as "Example!". Escape a literal "$" as "\$" in
  // .env files. This is purely a local .env-file-parsing behavior: .env is
  // gitignored and never present in a Vercel build, where env vars are
  // injected directly with no file-parsing/expansion step - confirmed by
  // testing the same value with no .env entry at all, which loads correctly.
  NEXT_PUBLIC_DEMO_EMAIL: z.string().optional(),
  NEXT_PUBLIC_DEMO_PASSWORD: z.string().optional(),
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
