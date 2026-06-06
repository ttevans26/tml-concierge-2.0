import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * Validate the caller's Supabase JWT from the Authorization header.
 * Returns the authenticated user or null if no valid session is present.
 */
export async function getAuthUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !ANON_KEY) return null;
  try {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    return { id: user.id, email: user.email ?? undefined };
  } catch {
    return null;
  }
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}