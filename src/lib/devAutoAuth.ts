/**
 * Shared dev account auto-sign-in for preview environments.
 *
 * In Lovable preview / local dev we don't want every reviewer to manually
 * sign up. We sign them straight into a shared `dev@tml.local` account so
 * the preview lands on `/` (Trips) with realistic data.
 *
 * Only fires when the host looks like a Lovable preview or localhost —
 * the production custom domain is unaffected.
 */
import { supabase } from "@/integrations/supabase/client";

export const DEV_EMAIL = "dev@tml.local";
export const DEV_PASSWORD = "tml-preview-2026";

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

let inflight: Promise<boolean> | null = null;

/**
 * Ensures a session exists in dev-preview environments by signing the
 * shared dev account in (creating it on first run thanks to the project's
 * zero-verification policy). Returns true if a session is established.
 * Safe to call multiple times — concurrent calls dedupe.
 */
export async function ensureDevSession(): Promise<boolean> {
  if (!isDevPreviewHost()) return false;
  if (inflight) return inflight;

  inflight = (async () => {
    // Already signed in? Nothing to do.
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) return true;

    // Try sign-in first. On the very first preview boot the account
    // won't exist yet, so fall back to sign-up (zero-verification →
    // immediate session).
    const signIn = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });
    if (!signIn.error && signIn.data.session) return true;

    const signUp = await supabase.auth.signUp({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });
    if (signUp.error) {
      // Most likely "user already registered" but the earlier sign-in
      // failed for some other reason. Surface to console for debugging.
      console.warn("[devAutoAuth] sign-up failed:", signUp.error.message);
      return false;
    }
    return !!signUp.data.session;
  })().finally(() => {
    // Allow retries on next invocation if needed (e.g. after sign-out).
    inflight = null;
  });

  return inflight;
}