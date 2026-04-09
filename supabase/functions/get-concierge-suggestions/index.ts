import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, startDate, endDate, existingItems } = await req.json();

    if (!destination) {
      return new Response(
        JSON.stringify({ error: "destination is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const itemsSummary = (existingItems || [])
      .map((i: any) => `${i.category}: ${i.title} (${i.date || "unscheduled"})`)
      .join("\n");

    const systemPrompt = `You are a luxury travel concierge for TML Concierge, a premium travel planning platform. You suggest hidden gems, route optimizations, and missing essentials for trips. Always explain WHY you suggest each item in a brief "Consultant's Note" style description.`;

    const userPrompt = `A traveler is planning a trip to **${destination}**${startDate ? ` from ${startDate} to ${endDate}` : ""}.

Their current itinerary includes:
${itemsSummary || "(empty itinerary)"}

Analyze the itinerary for gaps and opportunities. Provide exactly 5 suggestions that include:
- Hidden gems the traveler might miss
- Dining recommendations if there are gaps
- Activities that complement existing plans
- Logistical tips (e.g., convenient transfer spots)

Return suggestions using the "suggest_items" tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_items",
              description: "Return travel suggestions formatted as studio items",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Name of the place or activity" },
                        category: { type: "string", enum: ["stays", "dining", "activity", "sites"] },
                        description: { type: "string", description: "Consultant's Note explaining why this is suggested" },
                        address: { type: "string", description: "Approximate address or area" },
                        cost: { type: "number", description: "Estimated cost in USD, or null" },
                      },
                      required: ["title", "category", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_items" } },
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

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let suggestions: any[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = parsed.suggestions || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Format as studio-item-like objects with unique IDs
    const items = suggestions.map((s: any, i: number) => ({
      id: `concierge-${Date.now()}-${i}`,
      folder_id: "concierge",
      user_id: "concierge",
      category: s.category || "activity",
      title: s.title || "Suggestion",
      description: s.description || null,
      address: s.address || null,
      url: null,
      lat: null,
      lng: null,
      cost: s.cost ?? null,
      google_place_id: null,
      source_url: null,
      api_metadata: { source: "concierge", destination },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({ suggestions: items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("concierge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
