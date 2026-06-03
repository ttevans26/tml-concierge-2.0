/**
 * Provider-agnostic observability contracts.
 *
 * The app code only imports the singleton helpers from `./index` and never
 * talks to Sentry/PostHog/etc directly. This makes it trivial to swap
 * providers later (or wire native SDKs from Capacitor) without touching
 * feature code. Until a real provider is registered the implementations are
 * no-ops, so dev builds and self-hosted deployments keep working.
 */

export type Severity = "fatal" | "error" | "warning" | "info" | "debug";

export interface ErrorReporter {
  captureException(err: unknown, ctx?: Record<string, unknown>): void;
  captureMessage(msg: string, level?: Severity, ctx?: Record<string, unknown>): void;
  setUser(user: { id: string; email?: string | null } | null): void;
  addBreadcrumb(crumb: { category: string; message: string; data?: Record<string, unknown> }): void;
}

export interface Analytics {
  identify(userId: string, traits?: Record<string, unknown>): void;
  track(event: string, props?: Record<string, unknown>): void;
  page(name?: string, props?: Record<string, unknown>): void;
  reset(): void;
}

export interface WebVitalSample {
  name: "CLS" | "INP" | "LCP" | "FCP" | "TTFB";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  id: string;
}