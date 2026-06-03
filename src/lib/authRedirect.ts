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

const NATIVE_SCHEME = "app.lovable.tmlconcierge://auth/callback";

export function getAuthRedirectUri(): string {
  try {
    if (Capacitor.isNativePlatform()) {
      // TODO(native-auth): wire NATIVE_SCHEME into Info.plist + AndroidManifest
      // and switch this branch to return NATIVE_SCHEME. Logging today so we
      // see the call site light up the first time we ship a device build.
      if (import.meta.env.DEV) {
        console.warn(
          "[auth] native OAuth redirect not yet wired — falling back to web origin",
          { plannedScheme: NATIVE_SCHEME },
        );
      }
    }
  } catch {
    /* Capacitor unavailable in this env — web path is correct */
  }
  return window.location.origin;
}