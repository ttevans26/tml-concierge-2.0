/**
 * Dev auto-sign-in is INTENTIONALLY DISABLED.
 *
 * Previously this module silently signed every preview visitor into a
 * shared `dev@tml.local` account. That caused real-data loss confusion:
 * any logout, fresh tab, or new device would silently re-auth into the
 * dev account instead of the owner's real Google/email account, hiding
 * their trips behind RLS and risking writes to the wrong user.
 *
 * `ensureDevSession()` is now a no-op. All callers continue to compile,
 * but unauthenticated visits go through the normal `/login` flow.
 * Exports are preserved so existing imports keep working.
 */
import { supabase } from "@/integrations/supabase/client";

export const DEV_EMAIL = "dev@tml.local";
export const DEV_PASSWORD = "tml-preview-2026";

const SUPPRESS_KEY = "tml.devAutoAuth.suppressed";

/** Once set, ensureDevSession() short-circuits until cleared. Persists for
 *  the tab session so the user lands on /login after sign-out instead of
 *  being instantly re-authed into the shared dev account. */
export function suppressDevAutoAuth(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(SUPPRESS_KEY, "1"); } catch { /* ignore */ }
}

export function clearDevAutoAuthSuppression(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(SUPPRESS_KEY); } catch { /* ignore */ }
}

export function isDevAutoAuthSuppressed(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(SUPPRESS_KEY) === "1"; } catch { return false; }
}

/** True when running in a Lovable preview / project URL or on localhost. */
export function isDevPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovable.dev")
  );
}

/**
 * No-op. Kept as an export so existing callers compile.
 * Always resolves to `false` — visitors must sign in explicitly.
 */
export async function ensureDevSession(): Promise<boolean> {
  // Reference `supabase` to avoid an unused-import lint without changing behavior.
  void supabase;
  return false;
}