/**
 * Standard handler wrapper. Centralizes:
 *   - CORS preflight
 *   - request-id + structured logging
 *   - rate-limit response shape
 *   - ValidationError -> 400
 *   - unhandled errors -> 500 with safe message
 */
import { corsHeaders, jsonResponse, preflight } from "./cors.ts";
import { createLogger, type Logger } from "./logger.ts";
import { ValidationError } from "./validate.ts";
import { consumeToken, clientKey, type RateLimitOptions } from "./rate-limit.ts";

export interface HandlerContext {
  req: Request;
  log: Logger;
}

export interface HandlerOptions {
  fn: string;
  rateLimit?: Omit<RateLimitOptions, "key"> & { perUser?: boolean };
}

export function createHandler(
  opts: HandlerOptions,
  handler: (ctx: HandlerContext) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const pre = preflight(req);
    if (pre) return pre;

    const reqId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const log = createLogger(opts.fn, reqId);
    log.info("request_start", { method: req.method, path: new URL(req.url).pathname });

    if (opts.rateLimit) {
      const key = clientKey(req, opts.fn);
      const r = consumeToken({ ...opts.rateLimit, key });
      if (!r.allowed) {
        log.warn("rate_limited", { retryAfterSec: r.retryAfterSec });
        return new Response(
          JSON.stringify({ error: "Too many requests", retry_after: r.retryAfterSec }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(r.retryAfterSec),
            },
          },
        );
      }
    }

    try {
      const res = await handler({ req, log });
      log.info("request_end", { status: res.status });
      // Echo request-id for client-side correlation.
      res.headers.set("x-request-id", reqId);
      return res;
    } catch (err) {
      if (err instanceof ValidationError) {
        log.warn("validation_error", { field: err.field, msg: err.message });
        return jsonResponse({ error: err.message, field: err.field }, 400);
      }
      log.error("unhandled_error", {
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return jsonResponse({ error: "Internal error", request_id: reqId }, 500);
    }
  };
}