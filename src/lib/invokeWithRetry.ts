import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Wrapper around supabase.functions.invoke with exponential backoff retry +
 * a consistent toast surface on terminal failure. Use across all client-side
 * edge function calls so error UX is uniform (toast + retry option).
 */
export interface InvokeWithRetryOptions {
  /** Body to send. Same shape as supabase.functions.invoke body. */
  body?: unknown;
  /** Max number of attempts (including first). Defaults to 3. */
  attempts?: number;
  /** Base delay in ms (doubled per retry). Defaults to 400. */
  baseDelayMs?: number;
  /** Toast message on terminal failure. Falsy = no toast. */
  errorToast?: string | false;
  /** Optional retry handler (callable from the toast Action). */
  onRetry?: () => void;
  /** Additional headers. */
  headers?: Record<string, string>;
}

export async function invokeWithRetry<T = unknown>(
  functionName: string,
  opts: InvokeWithRetryOptions = {},
): Promise<T> {
  const {
    body,
    attempts = 3,
    baseDelayMs = 400,
    errorToast = `${functionName} failed. Please try again.`,
    onRetry,
    headers,
  } = opts;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body as any,
        headers,
      });
      if (error) throw error;
      return data as T;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
      }
    }
  }

  if (errorToast) {
    toast.error(errorToast, {
      action: onRetry
        ? { label: "Retry", onClick: onRetry }
        : undefined,
    });
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`${functionName}: unknown error`);
}