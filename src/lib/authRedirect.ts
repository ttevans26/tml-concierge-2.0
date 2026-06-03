/**
 * Computes the OAuth redirect URI for the current platform.
 *
 * - Web/preview: `window.location.origin` (matches Lovable Cloud allowlist).
 * - Native (Capacitor iOS): a custom URL scheme registered in
 *   `ios/App/App/Info.plist` once the native shell is built. Until then
 *   we still return `window.location.origin` so the Lovable preview
 *   continues to work — and log a warning so we catch the missing scheme
 *   the first time someone tries OAuth from a TestFlight build.
 *
 * The scheme is namespaced under the Capacitor `appId` to avoid clashing
 * with the universal-link path used by Apple Sign-In on web.
 */
import { Capacitor } from "@capacitor/core";

/**
 * Custom URL scheme that the iOS shell will register in `Info.plist`
 * (CFBundleURLSchemes). When OAuth returns via this scheme, the
 * `useDeepLinks` hook routes the URL to `/auth/callback` and the session
 * is finalised there.
 */
const NATIVE_SCHEME = "app.lovable.tmlconcierge";
const CALLBACK_PATH = "/auth/callback";

/**
 * Computes the OAuth redirect URI for the current platform.
 *
 * - Web/preview: `<origin>/auth/callback` — handled by the new
 *   `AuthCallback` route, which exchanges the code/fragment and forwards
 *   to the original `redirectTo` target.
 * - Native (Capacitor iOS): `app.lovable.tmlconcierge://auth/callback`.
 *   The OS hands the URL to `App.addListener('appUrlOpen', ...)`, which
 *   `useDeepLinks` forwards into React Router.
 *
 * Callers may pass an `intendedPath` so the post-OAuth landing matches
 * the user's pre-auth deep link (e.g. /concierge?ask=...).
 */
export function getAuthRedirectUri(intendedPath?: string): string {
  const suffix = intendedPath
    ? `?redirectTo=${encodeURIComponent(intendedPath)}`
    : "";

  try {
    if (Capacitor.isNativePlatform()) {
      return `${NATIVE_SCHEME}:/${CALLBACK_PATH}${suffix}`;
    }
  } catch {
    /* Capacitor unavailable in this env — fall through to web path */
  }

  return `${window.location.origin}${CALLBACK_PATH}${suffix}`;
}