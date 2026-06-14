// Proxies Google Static Maps via the Lovable connector gateway so the
// browser can use a simple <img src> without exposing server keys.
// Deployed with verify_jwt=false so <img> tags can load it directly.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
    return new Response("Missing Google Maps connector credentials", {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Forward the query string verbatim. The gateway injects the API key.
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const target = `${GATEWAY_URL}/maps/api/staticmap?${qs}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(`Upstream error ${upstream.status}: ${text}`, {
        status: upstream.status,
        headers: corsHeaders,
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return new Response(`Proxy failed: ${(err as Error).message}`, {
      status: 502,
      headers: corsHeaders,
    });
  }
});