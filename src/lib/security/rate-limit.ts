/**
 * Rate-limiting abstraction (requirement #36).
 *
 * The interface is storage-agnostic on purpose: swap `InMemoryRateLimiter`
 * for a Redis-backed implementation (e.g. using `ioredis` or
 * `@upstash/redis`) without touching any call site, by implementing the
 * same `RateLimiter` interface and changing what `getRateLimiter()` returns.
 *
 * IMPORTANT LIMITATION: `InMemoryRateLimiter` keeps counters in a
 * process-local Map. This is NOT safe for production multi-instance or
 * serverless deployments - every instance/invocation has its own counters,
 * so the real effective limit is (perInstanceLimit * instanceCount), and
 * counters reset on cold start. It is provided only so the login/register/
 * refresh routes have a working rate limiter in local development. Before
 * deploying to more than one instance, implement `RateLimiter` against a
 * shared store (Redis is the standard choice) and swap it in below.
 */
export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number };

export type RateLimiter = {
  consume(key: string): Promise<RateLimitResult>;
};

type Bucket = { count: number; resetAt: number };

class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    if (existing.count >= this.limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
    }

    existing.count += 1;
    return { allowed: true };
  }
}

// Separate limiters per sensitive action, matching requirement #36's list
// (login, register, refresh, future password reset). Tune limits per your
// threat model; these are conservative development defaults.
const limiters = {
  login: new InMemoryRateLimiter(10, 60_000), // 10 attempts / minute / key
  register: new InMemoryRateLimiter(5, 60_000),
  refresh: new InMemoryRateLimiter(30, 60_000),
  passwordReset: new InMemoryRateLimiter(5, 60_000),
  impersonate: new InMemoryRateLimiter(20, 60_000), // requirement #21 - Super Admin "Login as User"
};

export function getRateLimiter(action: keyof typeof limiters): RateLimiter {
  return limiters[action];
}

/**
 * Builds a rate-limit key from the client IP + the action.
 *
 * X-Forwarded-For is entirely client-controllable input unless a real
 * reverse proxy in front of this app overwrites/appends to it - trusting the
 * first (or any single) value unconditionally lets an attacker send a fresh
 * spoofed value on every request and get a brand-new bucket each time,
 * bypassing the limiter completely. This module doesn't know its own
 * deployment topology, so trusting the header is opt-in via
 * `trustedProxyHops` (see TRUSTED_PROXY_HOPS in src/config/env.ts - callers
 * pass `getEnv().TRUSTED_PROXY_HOPS`): standard "trust proxy: N" semantics,
 * where the trustworthy IP is the Nth entry from the RIGHT of the
 * X-Forwarded-For chain (each trusted hop appends what it saw; everything to
 * the left of that is attacker-controllable input the proxy chain merely
 * passed through).
 *
 * With the safe default (0 trusted hops - i.e. not configured for the real
 * deployment), the header is never trusted and every request collapses into
 * one shared per-action bucket - weaker per-client granularity, but no
 * longer spoofable into an unlimited number of buckets. Pure function
 * (no process.env access) so it stays trivial to unit test.
 */
export function rateLimitKeyFromRequest(request: Request, action: string, trustedProxyHops: number): string {
  if (trustedProxyHops > 0) {
    const chain = request.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const trustedIp = chain && chain.length >= trustedProxyHops ? chain[chain.length - trustedProxyHops] : undefined;
    if (trustedIp) return `${action}:${trustedIp}`;
  }
  return `${action}:unknown`;
}
