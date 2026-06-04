import type { ErrorReporter, Severity } from "./types";

/**
 * Sentry adapter — kept as a thin shim so the rest of the app never touches
 * the SDK directly. Activate by:
 *   1. `bun add @sentry/react`
 *   2. Set VITE_SENTRY_DSN in the env
 *   3. Uncomment the dynamic import below and call `registerErrorReporter`
 *      from main.tsx.
 *
 * This file intentionally has no runtime dependency on `@sentry/react` so
 * the bundle stays clean until you opt in.
 */
export async function createSentryReporter(dsn: string): Promise<ErrorReporter> {
  // Lazy require avoids bundling Sentry when DSN is unset.
  const Sentry = await import(/* @vite-ignore */ "@sentry/react").catch(() => null);
  if (!Sentry) {
    if (import.meta.env.DEV) console.warn("[sentry] package not installed; skipping init");
    return {
      captureException: () => {},
      captureMessage: () => {},
      setUser: () => {},
      addBreadcrumb: () => {},
    };
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
  return {
    captureException: (err, ctx) => Sentry.captureException(err, { extra: ctx }),
    captureMessage: (msg, level: Severity = "info", ctx) =>
      Sentry.captureMessage(msg, { level: level as never, extra: ctx }),
    setUser: (user) => Sentry.setUser(user),
    addBreadcrumb: (crumb) => Sentry.addBreadcrumb(crumb),
  };
}