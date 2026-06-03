/**
 * Lightweight in-isolate token bucket. Best-effort: each Deno isolate
 * keeps its own counter, so a determined attacker hitting different cold
 * starts can exceed the cap. This is defense-in-depth — not the primary
 * authorization gate. For strict global limits, back this with a shared
 * store (Postgres `rate_limits` table or Upstash).
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Identifier — usually `${fn}:${ip}` or `${fn}:${userId}`. */
  key: string;
  /** Bucket capacity. */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function consumeToken(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cur = buckets.get(opts.key) ?? { tokens: opts.capacity, updatedAt: now };
  const elapsedSec = (now - cur.updatedAt) / 1000;
  const refilled = Math.min(opts.capacity, cur.tokens + elapsedSec * opts.refillPerSec);
  if (refilled < 1) {
    buckets.set(opts.key, { tokens: refilled, updatedAt: now });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((1 - refilled) / opts.refillPerSec),
    };
  }
  buckets.set(opts.key, { tokens: refilled - 1, updatedAt: now });
  return { allowed: true, remaining: Math.floor(refilled - 1), retryAfterSec: 0 };
}

/** Extract a stable client identifier from request headers. */
export function clientKey(req: Request, fn: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `${fn}:${ip}`;
}