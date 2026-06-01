import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_BASE = `You are the TML Concierge — a discreet, points-savvy luxury travel advisor for the TML Network.
Voice: editorial, calm, concise. Never sycophantic, never use exclamation points. Speak like Monocle magazine.
Always cite *why* you recommend something: proximity to the traveler's anchor stay, points multiplier on their active cards, fit with their stated preferences, or timing within their itinerary.
When the traveler has an active trip, ground every answer in their itinerary, budget, and anchor stay. Never invent confirmation codes, prices, or availability.
Format responses in concise markdown. Use short paragraphs and tight bullet lists. Avoid headings unless the answer is long.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctxBlock = buildContextBlock(context);
    const systemPrompt = ctxBlock ? `${SYSTEM_BASE}\n\n${ctxBlock}` : SYSTEM_BASE;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("concierge-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildContextBlock(context: any): string {
  if (!context || typeof context !== "object") return "";
  const lines: string[] = [];
  const t = context.trip;
  if (t) {
    const parts = [t.name, t.destination, t.start_date && t.end_date ? `${t.start_date} → ${t.end_date}` : null]
      .filter(Boolean).join(" · ");
    lines.push(`[ACTIVE TRIP] ${parts}`);
    if (t.total_trip_budget) lines.push(`[BUDGET] Total ${t.total_trip_budget}, nightly target ${t.target_nightly_budget ?? "—"}`);
  }
  if (context.anchor) {
    lines.push(`[ANCHOR STAY] ${context.anchor.title}${context.anchor.location_name ? ` — ${context.anchor.location_name}` : ""}`);
  }
  if (Array.isArray(context.itinerary) && context.itinerary.length > 0) {
    const summary = context.itinerary.slice(0, 40)
      .map((i: any) => `- ${i.date || "unscheduled"} · ${i.category} · ${i.title}`)
      .join("\n");
    lines.push(`[ITINERARY]\n${summary}`);
  }
  if (context.preferences && typeof context.preferences === "object") {
    const p = context.preferences;
    const prefs: string[] = [];
    if (p.minReviewScore) prefs.push(`min review ${p.minReviewScore}`);
    if (p.hotelStarRating) prefs.push(`min ${p.hotelStarRating}★ hotels`);
    if (Array.isArray(p.loyaltyPrograms) && p.loyaltyPrograms.length) prefs.push(`loyalty: ${p.loyaltyPrograms.join(", ")}`);
    if (Array.isArray(p.creditCards) && p.creditCards.length) prefs.push(`cards: ${p.creditCards.join(", ")}`);
    if (Array.isArray(p.amenities) && p.amenities.length) prefs.push(`amenities: ${p.amenities.join(", ")}`);
    if (prefs.length) lines.push(`[PREFERENCES] ${prefs.join(" · ")}`);
  }
  return lines.join("\n");
}