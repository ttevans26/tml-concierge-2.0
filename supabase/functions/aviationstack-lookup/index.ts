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
    const { flight_iata, flight_date } = await req.json();

    if (!flight_iata || typeof flight_iata !== "string") {
      return new Response(
        JSON.stringify({ error: "flight_iata is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("AVIATIONSTACK_API_KEY");
    if (!apiKey) {
      throw new Error("AVIATIONSTACK_API_KEY is not configured");
    }

    const params = new URLSearchParams({
      access_key: apiKey,
      flight_iata: flight_iata.trim().toUpperCase(),
    });
    if (flight_date) {
      params.set("flight_date", flight_date);
    }

    const url = `http://api.aviationstack.com/v1/flights?${params.toString()}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Aviationstack error:", resp.status, errText);
      return new Response(
        JSON.stringify({ error: `Aviationstack API error: ${resp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();

    if (!data.data || data.data.length === 0) {
      return new Response(
        JSON.stringify({ error: "No flight found", results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const flight = data.data[0];
    const result = {
      departure_airport: flight.departure?.airport || null,
      arrival_airport: flight.arrival?.airport || null,
      departure_time: flight.departure?.scheduled || null,
      arrival_time: flight.arrival?.scheduled || null,
      terminal: flight.departure?.terminal || null,
      gate: flight.departure?.gate || null,
      airline: flight.airline?.name || null,
      flight_status: flight.flight_status || null,
      delay_minutes: flight.departure?.delay || 0,
    };

    return new Response(JSON.stringify({ flight: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("aviationstack-lookup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
