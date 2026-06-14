import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Frankfurter is a free, no-key, no-rate-limit FX API backed by the ECB.
const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1/latest";

const ALLOWED_CURRENCIES = new Set([
  "USD","EUR","GBP","JPY","CHF","AUD","CAD","NZD","CNY","HKD",
  "SGD","SEK","NOK","DKK","MXN","BRL","ZAR","INR","KRW","THB",
  "TRY","AED","ILS","PLN","CZK","HUF",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorizedResponse(corsHeaders);

    const { searchParams } = new URL(req.url);
    const base = (searchParams.get("base") || "USD").toUpperCase();
    if (!ALLOWED_CURRENCIES.has(base)) {
      return j({ error: `Unsupported base currency: ${base}` }, 400);
    }

    const targets = Array.from(ALLOWED_CURRENCIES).filter((c) => c !== base).join(",");
    const url = `${FRANKFURTER_BASE}?base=${base}&symbols=${targets}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) {
      return j({ error: `Upstream FX error (${r.status})` }, 502);
    }
    const data = await r.json();
    return j({
      base,
      rates: { ...(data.rates || {}), [base]: 1 },
      fetched_at: new Date().toISOString(),
      source: "frankfurter.dev",
      as_of: data.date || null,
    });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }

  function j(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});