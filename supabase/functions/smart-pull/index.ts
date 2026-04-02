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
    const { email_text } = await req.json();
    if (!email_text || typeof email_text !== "string" || email_text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Please paste a confirmation email with enough detail to extract." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a travel confirmation email parser. Extract ALL travel-related bookings from the provided email text. For each booking found, extract the relevant fields. If a field is not found, omit it. Dates should be in YYYY-MM-DD format. Times should be in HH:MM (24h) format. Categories: "stays" for hotels/accommodations, "logistics" for flights/trains/transfers, "dining" for restaurant reservations, "activity" for tours/experiences/events. Always extract confirmation codes/PNR numbers when present.`;

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
          { role: "user", content: email_text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_travel_items",
              description: "Extract structured travel booking items from email confirmation text.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Booking title, e.g. 'Delta DL123 JFK→LAX' or 'The Ritz-Carlton'" },
                        category: { type: "string", enum: ["stays", "logistics", "dining", "activity"] },
                        date: { type: "string", description: "YYYY-MM-DD" },
                        start_time: { type: "string", description: "HH:MM 24h format" },
                        end_time: { type: "string", description: "HH:MM 24h format" },
                        description: { type: "string" },
                        confirmation_code: { type: "string", description: "PNR, confirmation number, or booking reference" },
                        flight_number: { type: "string", description: "IATA flight number e.g. AA100" },
                        departure_airport: { type: "string", description: "3-letter IATA code" },
                        arrival_airport: { type: "string", description: "3-letter IATA code" },
                        location_name: { type: "string" },
                        estimated_cost: { type: "number" },
                        currency: { type: "string", description: "3-letter currency code, default USD" },
                      },
                      required: ["title", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_travel_items" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI extraction failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Could not extract travel items from this text.", items: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const items = parsed.items || [];

    console.log(`Smart Pull extracted ${items.length} item(s)`);

    return new Response(
      JSON.stringify({ items }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("smart-pull error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
