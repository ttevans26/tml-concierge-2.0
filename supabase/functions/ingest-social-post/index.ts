import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/cors.ts";
import { createHandler } from "../_shared/handler.ts";
import { obj, str, optional, url as urlValidator } from "../_shared/validate.ts";

const InputSchema = obj({
  url: urlValidator({ max: 2048 }),
  note: optional(str({ max: 500 })),
});

function detectPlatform(url: string): "instagram" | "tiktok" | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.endsWith("instagram.com")) return "instagram";
    if (h.endsWith("tiktok.com") || h === "vm.tiktok.com") return "tiktok";
    return null;
  } catch {
    return null;
  }
}

async function fetchOEmbed(platform: "instagram" | "tiktok", url: string) {
  // Public oEmbed endpoints (no auth). IG has been progressively locked down;
  // we try anonymously and gracefully degrade to caption-less import.
  let endpoint: string;
  if (platform === "tiktok") {
    endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  } else {
    endpoint = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
  }

  try {
    const res = await fetch(endpoint, {
      headers: {
        // Instagram requires a UA + a referer-like header for public oEmbed
        "User-Agent": "Mozilla/5.0 (compatible; TMLConciergeBot/1.0)",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.warn("oEmbed non-OK", platform, res.status);
      return null;
    }
    const json = await res.json();
    return {
      caption: json.title ?? json.author_name ?? null,
      thumbnail_url: json.thumbnail_url ?? null,
      author: json.author_name ?? null,
    };
  } catch (err) {
    console.warn("oEmbed fetch failed", platform, err);
    return null;
  }
}

const EXTRACTION_SYSTEM = `You are TML Elite Concierge. You receive the caption + author of a social travel post (Instagram or TikTok) and must extract:
1. The primary destination (city + country, or region) the post is about. If unclear, return null.
2. A list of specific places mentioned (hotels, restaurants, activities, sites). Skip generic advice.

For each item provide title, category ("stays" | "dining" | "activity" | "sites"), and a short note (1 sentence) capturing what the post says about it. Include address only if explicitly stated.`;

const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_travel_post",
    description: "Extract destination and recommended places from a social travel post.",
    parameters: {
      type: "object",
      properties: {
        destination: { type: ["string", "null"] },
        confidence: { type: "number", description: "0..1" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              category: { type: "string", enum: ["stays", "dining", "activity", "sites"] },
              address: { type: ["string", "null"] },
              note: { type: ["string", "null"] },
            },
            required: ["title", "category"],
          },
        },
      },
      required: ["destination", "items"],
    },
  },
};

async function extractWithGemini(apiKey: string, payload: {
  platform: string;
  url: string;
  caption: string | null;
  author: string | null;
  note: string | null;
}) {
  const userText = [
    `Platform: ${payload.platform}`,
    `URL: ${payload.url}`,
    payload.author ? `Author: ${payload.author}` : null,
    payload.note ? `User note: ${payload.note}` : null,
    `Caption:\n${payload.caption ?? "(not available — infer only from URL/author if possible, otherwise return empty items)"}`,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: userText },
      ],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "function", function: { name: "extract_travel_post" } },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini extraction failed ${res.status}: ${txt}`);
  }

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return { destination: null, items: [] };
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return { destination: null, items: [] };
  }
}

serve(
  createHandler(
    {
      fn: "ingest-social-post",
      // 10 imports/min/IP — LLM cost-sensitive
      rateLimit: { capacity: 10, refillPerSec: 10 / 60 },
    },
    async ({ req, log }) => {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) return jsonResponse({ error: "Invalid session" }, 401);
      const user = userData.user;
      log.bind({ userId: user.id });

      const raw = await req.json().catch(() => ({}));
      const { url, note } = InputSchema.parse(raw);

      const platform = detectPlatform(url);
      if (!platform)
        return jsonResponse(
          { error: "Only Instagram and TikTok URLs are supported right now." },
          400,
        );

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const oembed = await fetchOEmbed(platform, url);

    let extracted: { destination: string | null; items: any[] } = { destination: null, items: [] };
    let extractionError: string | null = null;
    try {
      extracted = await extractWithGemini(LOVABLE_API_KEY, {
        platform,
        url,
        caption: oembed?.caption ?? null,
        author: oembed?.author ?? null,
        note: note ?? null,
      });
    } catch (err: any) {
      log.error("extraction_error", { err: err?.message });
      extractionError = err?.message ?? "Extraction failed";
    }

    // Try to find a matching existing folder by destination (case-insensitive substring)
    let suggestedFolderId: string | null = null;
    if (extracted.destination) {
      const { data: folders } = await supabase
        .from("studio_folders")
        .select("id, name, location")
        .or(`name.ilike.%${extracted.destination}%,location.ilike.%${extracted.destination}%`)
        .limit(1);
      if (folders && folders.length > 0) suggestedFolderId = folders[0].id;
    }

    const itemsWithKeep = (extracted.items ?? []).map((it: any) => ({
      title: String(it.title ?? "").slice(0, 200),
      category: ["stays", "dining", "activity", "sites"].includes(it.category) ? it.category : "activity",
      address: it.address ?? null,
      note: it.note ?? null,
      keep: true,
    }));

    const status = extractionError
      ? "failed"
      : itemsWithKeep.length === 0 && !oembed?.caption
        ? "failed"
        : "pending";

    const { data: row, error: insertErr } = await supabase
      .from("studio_social_imports")
      .insert({
        user_id: user.id,
        source_url: url,
        platform,
        caption: oembed?.caption ?? null,
        thumbnail_url: oembed?.thumbnail_url ?? null,
        author: oembed?.author ?? null,
        detected_destination: extracted.destination ?? null,
        suggested_folder_id: suggestedFolderId,
        extracted_items: itemsWithKeep,
        status,
        error: extractionError,
        note: note ?? null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

      return jsonResponse({ import: row });
    },
  ),
);