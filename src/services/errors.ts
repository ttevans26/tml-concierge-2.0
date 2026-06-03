/**
 * All service-layer failures throw a `ServiceError`. UI code catches this
 * single type instead of branching on Supabase / fetch / native bridge
 * error shapes. Keeps error handling transport-agnostic.
 */
export class ServiceError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(message: string, code = "service_error", cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.cause = cause;
  }
}

/** Narrow helper for wrapping unknown errors from any transport. */
export function wrapError(label: string, err: unknown): never {
  if (err instanceof ServiceError) throw err;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
  throw new ServiceError(`${label}: ${message}`, "service_error", err);
}