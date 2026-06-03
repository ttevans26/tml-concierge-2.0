import type { Analytics, ErrorReporter, Severity, WebVitalSample } from "./types";

/**
 * Default no-op implementations. Replaced via `registerErrorReporter` /
 * `registerAnalytics` once a provider is wired (e.g. Sentry init in main.tsx
 * when VITE_SENTRY_DSN is set).
 */

const noopReporter: ErrorReporter = {
  captureException: (err) => {
    if (import.meta.env.DEV) console.error("[obs:noop]", err);
  },
  captureMessage: (msg, level = "info") => {
    if (import.meta.env.DEV) console.log(`[obs:noop:${level}]`, msg);
  },
  setUser: () => {},
  addBreadcrumb: () => {},
};

const noopAnalytics: Analytics = {
  identify: () => {},
  track: (event, props) => {
    if (import.meta.env.DEV) console.log("[analytics:noop]", event, props ?? {});
  },
  page: () => {},
  reset: () => {},
};

let reporter: ErrorReporter = noopReporter;
let analytics: Analytics = noopAnalytics;

export function registerErrorReporter(impl: ErrorReporter) {
  reporter = impl;
}

export function registerAnalytics(impl: Analytics) {
  analytics = impl;
}

export const obs = {
  captureException: (err: unknown, ctx?: Record<string, unknown>) =>
    reporter.captureException(err, ctx),
  captureMessage: (msg: string, level?: Severity, ctx?: Record<string, unknown>) =>
    reporter.captureMessage(msg, level, ctx),
  setUser: (user: { id: string; email?: string | null } | null) => {
    reporter.setUser(user);
    if (user) analytics.identify(user.id, { email: user.email ?? undefined });
    else analytics.reset();
  },
  breadcrumb: (category: string, message: string, data?: Record<string, unknown>) =>
    reporter.addBreadcrumb({ category, message, data }),
  track: (event: string, props?: Record<string, unknown>) => analytics.track(event, props),
  page: (name?: string, props?: Record<string, unknown>) => analytics.page(name, props),
};

/**
 * Streams Core Web Vitals to both the error reporter (as breadcrumbs for
 * crash context) and the analytics sink. Call once from main.tsx.
 */
export async function initWebVitals(onMetric?: (m: WebVitalSample) => void) {
  if (typeof window === "undefined") return;
  const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import("web-vitals");
  const handle = (m: WebVitalSample) => {
    obs.breadcrumb("web-vital", m.name, { value: m.value, rating: m.rating });
    analytics.track("web_vital", { name: m.name, value: m.value, rating: m.rating });
    onMetric?.(m);
  };
  onCLS(handle as never);
  onINP(handle as never);
  onLCP(handle as never);
  onFCP(handle as never);
  onTTFB(handle as never);
}

export type { Analytics, ErrorReporter, WebVitalSample } from "./types";