/**
 * Lightweight session cache. Avoids round-tripping `supabase.auth.getUser()`
 * on every store mutation (each call is a network hit on cellular). The
 * cache is fed by `useAuth`'s `onAuthStateChange` listener, so it stays
 * in sync with Supabase's view of the session.
 *
 * Falls back to a live `getUser()` call if the cache is cold — e.g. a
 * mutation fires before the auth provider has mounted.
 */
import { supabase } from "@/integrations/supabase/client";

let cachedUserId: string | null = null;
let warmed = false;

export function setCachedUserId(id: string | null): void {
  cachedUserId = id;
  warmed = true;
}

export function peekCachedUserId(): string | null {
  return cachedUserId;
}

/**
 * Returns the current authenticated user id, preferring the in-memory
 * cache. Returns `null` for unauthenticated sessions. Use this everywhere
 * a store/service previously called `supabase.auth.getUser()`.
 */
export async function getCachedUserId(): Promise<string | null> {
  if (warmed) return cachedUserId;
  try {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id ?? null;
    setCachedUserId(id);
    return id;
  } catch {
    return null;
  }
}