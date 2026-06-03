/**
 * Structured JSON logger. One-line-per-event so Supabase log explorer + any
 * downstream ingester (Sentry, Logflare, etc.) can parse without regex.
 */
type Level = "debug" | "info" | "warn" | "error";

export interface LogContext {
  fn: string;
  reqId: string;
  userId?: string;
  [k: string]: unknown;
}

function emit(level: Level, ctx: LogContext, msg: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
    ...(extra ?? {}),
  });
  // deno-lint-ignore no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export function createLogger(fn: string, reqId = crypto.randomUUID()) {
  const base: LogContext = { fn, reqId };
  return {
    reqId,
    with: (extra: Record<string, unknown>) => createLogger(fn, reqId).bind(extra),
    bind(extra: Record<string, unknown>) {
      Object.assign(base, extra);
      return this;
    },
    debug: (m: string, e?: Record<string, unknown>) => emit("debug", base, m, e),
    info:  (m: string, e?: Record<string, unknown>) => emit("info",  base, m, e),
    warn:  (m: string, e?: Record<string, unknown>) => emit("warn",  base, m, e),
    error: (m: string, e?: Record<string, unknown>) => emit("error", base, m, e),
  };
}

export type Logger = ReturnType<typeof createLogger>;