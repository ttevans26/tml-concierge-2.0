import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createHandler } from "../_shared/handler.ts";
import { obj, str, optional } from "../_shared/validate.ts";

const InputSchema = obj({
  flight_iata: str({ min: 2, max: 16, pattern: /^[A-Za-z0-9 ]+$/ }),
  flight_date: optional(str({ pattern: /^\d{4}-\d{2}-\d{2}$/ })),
});

serve(
  createHandler(
    {
      fn: "aviationstack-lookup",
      // 30 requests/min per IP. External API has per-day quota; this guards
      // against accidental loops in the client more than abuse.
      rateLimit: { capacity: 30, refillPerSec: 0.5 },
    },
    async ({ req, log }) => {
      const body = await req.json().catch(() => ({}));
      const { flight_iata, flight_date } = InputSchema.parse(body);

      const apiKey = Deno.env.get("AVIATIONSTACK_API_KEY");
      if (!apiKey) {
        log.error("missing_api_key");
        return jsonResponse({ error: "Flight provider not configured" }, 500);
      }

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
    log.info("aviationstack_request", { iata: sanitizedIata, hasDate: !!flight_date });

    let resp: Response;
    try {
      resp = await fetch(url);
    } catch (fetchErr) {
      log.error("aviationstack_fetch_failed", { err: String(fetchErr) });
      return jsonResponse({ error: "Failed to connect to flight data provider" }, 502);
    }

    const bodyText = await resp.text();

    if (!resp.ok) {
      log.warn("aviationstack_non_2xx", { status: resp.status });

      // If we got a 403 with flight_date, retry without it (free plan restriction)
      if (resp.status === 403 && flight_date) {
        log.info("aviationstack_retry_without_date");
        params.delete("flight_date");
        const retryUrl = `http://api.aviationstack.com/v1/flights?${params.toString()}`;
        try {
          const retryResp = await fetch(retryUrl);
          const retryBody = await retryResp.text();
          if (!retryResp.ok) {
            log.error("aviationstack_retry_failed", { status: retryResp.status });
            return jsonResponse({ error: "Flight provider unavailable" }, 502);
          }
          // Use retry body for parsing below
          const retryData = JSON.parse(retryBody);
          if (!retryData.data || retryData.data.length === 0) {
            return jsonResponse({ error: "Flight details not found. Please enter manually." }, 200);
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
          return jsonResponse({ flight: result });
        } catch (retryErr) {
          log.error("aviationstack_retry_exception", { err: String(retryErr) });
        }
      }

      return jsonResponse({ error: "Flight provider error" }, 502);
    }

    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      log.error("aviationstack_invalid_json");
      return jsonResponse({ error: "Invalid response from flight data provider" }, 502);
    }

    if (!data.data || data.data.length === 0) {
      return jsonResponse({ error: "No flight found", results: [] }, 200);
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

    return jsonResponse({ flight: result });
    },
  ),
);
