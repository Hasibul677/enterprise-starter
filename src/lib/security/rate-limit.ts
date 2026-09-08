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

/** Builds a rate-limit key from the client IP (best-effort) + the action. */
export function rateLimitKeyFromRequest(request: Request, action: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  return `${action}:${ip}`;
}
