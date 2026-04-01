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

    const apiKey = Deno.env.get("AVIATIONSTACK_API_KEY") || "20599670d86658c1b36c06d12a14dc9f";

    const sanitizedIata = String(flight_iata).replace(/\s+/g, "").toUpperCase();

    const params = new URLSearchParams({
      access_key: apiKey,
      flight_iata: sanitizedIata,
    });
    // Note: flight_date filter may not be available on free Aviationstack plans
    // so we only add it if provided but handle gracefully if the API rejects it
    if (flight_date) {
      params.set("flight_date", flight_date);
    }

    const url = `http://api.aviationstack.com/v1/flights?${params.toString()}`;
    console.log("Aviationstack request URL (key redacted):", url.replace(apiKey, "REDACTED"));

    let resp: Response;
    try {
      resp = await fetch(url);
    } catch (fetchErr) {
      console.error("Aviationstack fetch failed:", fetchErr);
      return new Response(
        JSON.stringify({ error: "Failed to connect to flight data provider" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bodyText = await resp.text();

    if (!resp.ok) {
      console.error("Aviationstack non-2xx:", resp.status, bodyText);

      // If we got a 403 with flight_date, retry without it (free plan restriction)
      if (resp.status === 403 && flight_date) {
        console.log("Retrying without flight_date (free plan fallback)...");
        params.delete("flight_date");
        const retryUrl = `http://api.aviationstack.com/v1/flights?${params.toString()}`;
        try {
          const retryResp = await fetch(retryUrl);
          const retryBody = await retryResp.text();
          if (!retryResp.ok) {
            console.error("Aviationstack retry also failed:", retryResp.status, retryBody);
            return new Response(
              JSON.stringify({ error: `Flight API error: ${retryBody}` }),
              { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // Use retry body for parsing below
          const retryData = JSON.parse(retryBody);
          if (!retryData.data || retryData.data.length === 0) {
            return new Response(
              JSON.stringify({ error: "Flight details not found. Please enter manually." }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          const flight = retryData.data[0];
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
        } catch (retryErr) {
          console.error("Retry fetch error:", retryErr);
        }
      }

      return new Response(
        JSON.stringify({ error: `Flight API error (${resp.status}): ${bodyText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      console.error("Failed to parse Aviationstack response:", bodyText);
      return new Response(
        JSON.stringify({ error: "Invalid response from flight data provider" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
