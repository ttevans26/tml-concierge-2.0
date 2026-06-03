import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const TRAVEL_QUERY =
  '(subject:(reservation OR booking OR confirmation OR itinerary OR ticket OR "e-ticket" OR "boarding pass") OR from:(booking.com OR airbnb.com OR marriott.com OR hilton.com OR hyatt.com OR ihg.com OR delta.com OR united.com OR aa.com OR opentable.com OR resy.com)) newer_than:90d';

const EXTRACT_SYS = `You are a travel confirmation email parser. Extract ALL travel-related bookings from the provided email text. Dates YYYY-MM-DD, times HH:MM 24h. Categories: stays, logistics, dining, activity. If the email is not a real travel confirmation, return empty items.`;

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_travel_items",
    description: "Extract structured travel booking items.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              category: { type: "string", enum: ["stays", "logistics", "dining", "activity"] },
              date: { type: "string" },
              start_time: { type: "string" },
              end_time: { type: "string" },
              description: { type: "string" },
              confirmation_code: { type: "string" },
              flight_number: { type: "string" },
              departure_airport: { type: "string" },
              arrival_airport: { type: "string" },
              location_name: { type: "string" },
              estimated_cost: { type: "number" },
              currency: { type: "string" },
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
};

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = (s.replace(/-/g, "+").replace(/_/g, "/")) + pad;
  try {
    const bin = atob(b);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function collectPlainText(payload: any): string {
  if (!payload) return "";
  const out: string[] = [];
  const walk = (part: any) => {
    if (!part) return;
    const mime = part.mimeType || "";
    if (mime.startsWith("text/plain") && part.body?.data) {
      out.push(b64urlDecode(part.body.data));
    } else if (mime.startsWith("text/html") && part.body?.data && out.length === 0) {
      const html = b64urlDecode(part.body.data);
      out.push(html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);
  return out.join("\n\n").slice(0, 12000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");

    // Status mode — lightweight credential check used by the Smart Pull Inbox
    // to display a "Connected / Not connected" indicator without invoking
    // the full sync pipeline.
    const url = new URL(req.url);
    if (url.searchParams.get("mode") === "status" || req.method === "GET") {
      if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
        return j({ connected: false, reason: "Gmail connector not linked" });
      }
      try {
        const verify = await fetch(
          "https://connector-gateway.lovable.dev/api/v1/verify_credentials",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
            },
          },
        );
        if (!verify.ok) {
          const txt = await verify.text();
          return j({ connected: false, reason: `Gateway ${verify.status}: ${txt.slice(0, 200)}` });
        }
        const data = await verify.json().catch(() => ({}));
        const ok = data?.outcome === "verified" || data?.outcome === "skipped";
        return j({ connected: ok, outcome: data?.outcome, reason: data?.error });
      } catch (e) {
        return j({ connected: false, reason: e instanceof Error ? e.message : "verify failed" });
      }
    }

    if (!LOVABLE_API_KEY) return j({ error: "AI key missing" }, 500);
    if (!GOOGLE_MAIL_API_KEY) return j({ error: "Gmail connector not linked" }, 500);

    const body = await req.json().catch(() => ({}));
    const maxResults = Math.min(Math.max(Number(body.maxResults || 10), 1), 25);

    const gw = (path: string) =>
      fetch(`${GATEWAY}${path}`, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
        },
      });

    // 1. List recent travel messages
    const listResp = await gw(`/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(TRAVEL_QUERY)}`);
    if (!listResp.ok) {
      const txt = await listResp.text();
      console.error("Gmail list error", listResp.status, txt);
      return j({ error: `Gmail list failed (${listResp.status})` }, 500);
    }
    const list = await listResp.json();
    const messageIds: string[] = (list.messages || []).map((m: { id: string }) => m.id);
    if (messageIds.length === 0) {
      return j({ items: [], scanned: 0, source: "gmail" });
    }

    // 2. Fetch each, extract text
    const texts: { id: string; subject: string; text: string }[] = [];
    for (const id of messageIds) {
      const r = await gw(`/users/me/messages/${id}?format=full`);
      if (!r.ok) continue;
      const msg = await r.json();
      const headers = (msg.payload?.headers || []) as { name: string; value: string }[];
      const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "(no subject)";
      const from = headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
      const date = headers.find((h) => h.name.toLowerCase() === "date")?.value || "";
      const text = collectPlainText(msg.payload);
      if (text.trim().length > 80) {
        texts.push({ id, subject, text: `From: ${from}\nSubject: ${subject}\nDate: ${date}\n\n${text}` });
      }
    }

    if (texts.length === 0) return j({ items: [], scanned: messageIds.length, source: "gmail" });

    // 3. Run extraction (parallel, capped)
    const extractOne = async (t: { id: string; subject: string; text: string }) => {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: EXTRACT_SYS },
            { role: "user", content: t.text },
          ],
          tools: [EXTRACT_TOOL],
          tool_choice: { type: "function", function: { name: "extract_travel_items" } },
        }),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return [];
      try {
        const parsed = JSON.parse(args);
        return (parsed.items || []).map((x: Record<string, unknown>) => ({
          ...x,
          source_reference: `gmail:${t.id}`,
          source_subject: t.subject,
        }));
      } catch {
        return [];
      }
    };
    const all = (await Promise.all(texts.map(extractOne))).flat();

    return j({ items: all, scanned: messageIds.length, parsed: texts.length, source: "gmail" });
  } catch (e) {
    console.error("smart-pull-gmail error", e);
    return j({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }

  function j(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});