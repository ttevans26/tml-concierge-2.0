import type { Analytics } from "./types";

/**
 * PostHog adapter. Activate by:
 *   1. `bun add posthog-js`
 *   2. Set VITE_POSTHOG_KEY (+ optional VITE_POSTHOG_HOST) in env
 *   3. Call `registerAnalytics(await createPostHogAnalytics(key, host))`
 *      from main.tsx.
 */
export async function createPostHogAnalytics(
  apiKey: string,
  host = "https://us.i.posthog.com",
): Promise<Analytics> {
  // @ts-expect-error — package is optional and added later.
  const mod = await import(/* @vite-ignore */ "posthog-js").catch(() => null);
  if (!mod) {
    if (import.meta.env.DEV) console.warn("[posthog] package not installed; skipping init");
    return { identify: () => {}, track: () => {}, page: () => {}, reset: () => {} };
  }
  const posthog = mod.default ?? mod;
  posthog.init(apiKey, {
    api_host: host,
    capture_pageview: false,
    persistence: "localStorage+cookie",
    autocapture: false,
  });
  return {
    identify: (id, traits) => posthog.identify(id, traits),
    track: (event, props) => posthog.capture(event, props),
    page: (name, props) => posthog.capture("$pageview", { name, ...props }),
    reset: () => posthog.reset(),
  };
}