import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthUser, unauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the TML Elite Concierge v2.1. You are an expert travel curator.

Given a URL and its text content, extract all travel-relevant items (hotels, restaurants, activities, sites of interest).

For each item, return a JSON object with these fields:
- title (string): The name of the place or experience
- category (string): One of "stays", "dining", "activity", "sites"
- description (string | null): A brief 1-2 sentence description
- address (string | null): Physical address if mentioned
- url (string | null): Direct URL to the place if available
- estimated_cost (number | null): Estimated cost in USD if mentioned

Return ONLY a valid JSON array of these objects. No markdown, no explanation.
If no travel items are found, return an empty array [].`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorizedResponse(corsHeaders);

    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls.filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0)
      : typeof body?.url === "string" && body.url.trim().length > 0
        ? [body.url]
        : [];

    const files: Array<{ filename?: string; mime: string; dataBase64: string }> = Array.isArray(body?.files)
      ? body.files.filter(
          (f: any) =>
            f && typeof f.dataBase64 === "string" && typeof f.mime === "string",
        )
      : [];

    if (urls.length === 0 && files.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide urls[] or files[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const urlResults = await Promise.all(
      urls.map((u) => processSingleUrl(u, LOVABLE_API_KEY))
    );
    const fileResults = await Promise.all(
      files.map((f) => processSingleFile(f, LOVABLE_API_KEY))
    );
    const results = [...urlResults, ...fileResults];

    // Single-URL legacy shape preserved when only one URL was passed
    if (urls.length === 1 && files.length === 0) {
      const r = results[0];
      if (r.error) {
        return new Response(JSON.stringify({ error: r.error }), {
          status: r.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ items: r.items, source_url: r.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Multi: aggregate response with per-source status
    const flatItems = results.flatMap((r) =>
      (r.items || []).map((i: any) => ({ ...i, source_url: r.url ?? null }))
    );
    return new Response(
      JSON.stringify({
        items: flatItems,
        results: results.map((r) => ({
          source: r.url ?? r.filename ?? "file",
          ok: !r.error,
          error: r.error || null,
          count: r.items?.length ?? 0,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scrape-and-parse error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processSingleUrl(url: string, apiKey: string): Promise<{
  url: string;
  items?: any[];
  error?: string;
  status?: number;
}> {
  // SSRF guard: only allow https:// and block private/loopback/link-local hosts.
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") {
      return { url, error: "Only https:// URLs are allowed", status: 400 };
    }
    const host = u.hostname.toLowerCase();
    const blocked =
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1?$|fc00:|fd00:|fe80:)/i.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked) {
      return { url, error: "Private or loopback URLs are not allowed", status: 400 };
    }
  } catch {
    return { url, error: "Invalid URL", status: 400 };
  }

  // Fetch page text
  let pageText = "";
  try {
    const pageResp = await fetch(url, { headers: { "User-Agent": "TML-Concierge/1.0" } });
    const html = await pageResp.text();
    pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
  } catch (fetchErr) {
    console.error("Failed to fetch URL:", url, fetchErr);
    pageText = `[Could not fetch content from ${url}. Please analyze the URL itself.]`;
  }

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `URL: ${url}\n\nPage Content:\n${pageText}` },
      ],
    }),
  });

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) return { url, error: "Rate limit exceeded", status: 429 };
    if (aiResponse.status === 402) return { url, error: "AI credits exhausted", status: 402 };
    const errText = await aiResponse.text();
    console.error("AI gateway error:", aiResponse.status, errText);
    return { url, error: `AI gateway error: ${aiResponse.status}`, status: 500 };
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || "[]";
  let items: any[] = [];
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) items = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error("Failed to parse AI response:", parseErr, content);
  }
  return { url, items };
}

async function processSingleFile(
  file: { filename?: string; mime: string; dataBase64: string },
  apiKey: string,
): Promise<{ url?: string; filename?: string; items?: any[]; error?: string; status?: number }> {
  const dataUrl = `data:${file.mime};base64,${file.dataBase64}`;
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Source file: ${file.filename ?? "uploaded"} (${file.mime}). ` +
                `Extract all travel items as a JSON array as specified.`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) return { filename: file.filename, error: "Rate limit exceeded", status: 429 };
    if (aiResponse.status === 402) return { filename: file.filename, error: "AI credits exhausted", status: 402 };
    const errText = await aiResponse.text();
    console.error("AI gateway error (file):", aiResponse.status, errText);
    return { filename: file.filename, error: `AI gateway error: ${aiResponse.status}`, status: 500 };
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || "[]";
  let items: any[] = [];
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) items = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error("Failed to parse AI file response:", parseErr, content);
  }
  return { filename: file.filename, items };
}
