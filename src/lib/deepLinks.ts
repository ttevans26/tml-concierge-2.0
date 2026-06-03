/**
 * Centralized deep-link → React Router path translation.
 *
 * Accepts URLs from three sources:
 *  1. Web visits to `https://tmlconcierge.com/...` (Universal Links).
 *  2. iOS custom scheme `app.lovable.tmlconcierge://...` (fallback when
 *     Universal Links aren't configured or the AASA file hasn't validated).
 *  3. The browser's own location bar (so deep-link logic stays one code path).
 *
 * Every supported deep link maps to an in-app React Router path with the
 * original query string + hash preserved — that's what lets us thread
 * OAuth fragments and concierge prompts through unchanged.
 */

export interface ParsedDeepLink {
  /** React Router pathname + search + hash, ready to feed `navigate()`. */
  to: string;
  /** Logical action — useful for analytics breadcrumbs. */
  intent:
    | "auth-callback"
    | "login"
    | "signup"
    | "reset-password"
    | "concierge"
    | "trip"
    | "shared-trip"
    | "passthrough";
}

const WEB_HOSTS = new Set([
  "tmlconcierge.com",
  "www.tmlconcierge.com",
  // Lovable preview / published hosts also forward here so the dev sandbox
  // exercises the same code path as production.
]);

const NATIVE_SCHEMES = new Set([
  "app.lovable.tmlconcierge:",
  "tmlconcierge:",
]);

/**
 * Parse an arbitrary inbound URL into an in-app route. Returns `null` when
 * the URL is not recognised so the caller can fall back to its default
 * (e.g. opening the share sheet in the OS browser).
 */
export function parseDeepLink(rawUrl: string): ParsedDeepLink | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const isNative = NATIVE_SCHEMES.has(url.protocol);
  const isUniversal =
    (url.protocol === "https:" || url.protocol === "http:") &&
    WEB_HOSTS.has(url.hostname);

  // For preview / non-prod hosts we still allow same-origin links so QA
  // can paste universal-link URLs into the dev sandbox.
  const sameOriginWeb =
    !isNative &&
    !isUniversal &&
    typeof window !== "undefined" &&
    url.origin === window.location.origin;

  if (!isNative && !isUniversal && !sameOriginWeb) return null;

  // Normalise pathname — native scheme URLs may stuff the "path" into the
  // host (e.g. `tmlconcierge://concierge?ask=hi` → host="concierge").
  let pathname = url.pathname || "/";
  if (isNative && (!pathname || pathname === "/") && url.hostname) {
    pathname = `/${url.hostname}${pathname === "/" ? "" : pathname}`;
  }
  const search = url.search;
  const hash = url.hash;

  // --- Auth callback (OAuth return) -----------------------------------
  if (pathname === "/auth/callback" || pathname.startsWith("/~oauth")) {
    return { to: `/auth/callback${search}${hash}`, intent: "auth-callback" };
  }

  // --- Auth surfaces --------------------------------------------------
  if (pathname === "/login" || pathname === "/auth/login") {
    return { to: `/login${search}`, intent: "login" };
  }
  if (pathname === "/signup" || pathname === "/auth/signup") {
    return { to: `/signup${search}`, intent: "signup" };
  }
  if (pathname === "/reset-password" || pathname === "/auth/reset") {
    return { to: `/reset-password${search}${hash}`, intent: "reset-password" };
  }

  // --- Concierge entrypoints -----------------------------------------
  // `/concierge?ask=...&trip=<id>` — pushes a pending prompt into the
  // store and routes the user into the relevant workspace.
  if (pathname === "/concierge" || pathname === "/ask") {
    return { to: `/concierge${search}`, intent: "concierge" };
  }
  if (pathname.startsWith("/trip/") && pathname.endsWith("/concierge")) {
    const tripId = pathname.split("/")[2];
    return { to: `/concierge?trip=${encodeURIComponent(tripId)}${search ? `&${search.slice(1)}` : ""}`, intent: "concierge" };
  }

  // --- Trip surfaces --------------------------------------------------
  if (/^\/trip\/[^/]+/.test(pathname)) {
    return { to: `${pathname}${search}${hash}`, intent: "trip" };
  }
  if (/^\/itinerary\/[^/]+/.test(pathname)) {
    return { to: `${pathname}${search}${hash}`, intent: "shared-trip" };
  }

  // Fallback: hand the path straight to the router (covers /today, /studio,
  // /tools, /network, etc.) so shared links inside the app keep working.
  return { to: `${pathname}${search}${hash}`, intent: "passthrough" };
}