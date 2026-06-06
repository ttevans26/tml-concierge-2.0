import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Scan all itinerary_items whose cancellation_deadline falls within the
 * user's preferred lead-time windows, and create deduplicated notifications.
 *
 * Intended to run on a daily cron via Supabase scheduled function, but can also
 * be invoked on-demand by the client (e.g. when the app opens).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authentication. Scope is always forced to the caller's user_id
    // — any caller-supplied user_id in the body is ignored. For cron use,
    // invoke this function via Supabase scheduled functions (which run with
    // the service role internally) rather than over the public HTTP edge.
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorizedResponse(corsHeaders);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Force scope to the authenticated user — never trust client-supplied IDs.
    const scopeUserId: string = authUser.id;
    try { await req.json(); } catch { /* empty body ok */ }

    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 30); // look ahead 30 days

    let q = admin
      .from("itinerary_items")
      .select("id, user_id, trip_id, title, cancellation_deadline")
      .not("cancellation_deadline", "is", null)
      .gte("cancellation_deadline", now.toISOString())
      .lte("cancellation_deadline", horizon.toISOString());
    if (scopeUserId) q = q.eq("user_id", scopeUserId);

    const { data: items, error } = await q;
    if (error) throw error;

    // Load profiles for lead-time prefs
    const userIds = Array.from(new Set((items || []).map((i: any) => i.user_id)));
    const prefsByUser: Record<string, number[]> = {};
    if (userIds.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, notification_preferences")
        .in("user_id", userIds);
      for (const p of profs || []) {
        const np = (p as any).notification_preferences || {};
        prefsByUser[(p as any).user_id] = Array.isArray(np.cancellation_lead_days)
          ? np.cancellation_lead_days
          : [7, 3, 1];
      }
    }

    let created = 0;
    for (const item of items || []) {
      const deadline = new Date((item as any).cancellation_deadline);
      const daysOut = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
      const leadDays = prefsByUser[(item as any).user_id] ?? [7, 3, 1];

      // Trigger if today equals any lead-time window (within 1 day tolerance)
      const hit = leadDays.find((d) => Math.abs(d - daysOut) < 1);
      if (hit == null) continue;

      // Dedup: skip if a notification for this item+lead-window already exists
      const dedupKey = `cancellation_${hit}d`;
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", (item as any).user_id)
        .eq("item_id", (item as any).id)
        .eq("kind", dedupKey)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const { error: insErr } = await admin.from("notifications").insert({
        user_id: (item as any).user_id,
        trip_id: (item as any).trip_id,
        item_id: (item as any).id,
        kind: dedupKey,
        title: `Cancellation window closing — ${(item as any).title}`,
        body: `Free cancellation ends in ${hit} day${hit === 1 ? "" : "s"} (${deadline.toLocaleDateString()}).`,
        due_at: deadline.toISOString(),
        metadata: { lead_days: hit },
      });
      if (!insErr) created++;
    }

    return new Response(JSON.stringify({ ok: true, scanned: items?.length ?? 0, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cancellation-scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});