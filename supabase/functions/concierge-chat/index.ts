import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_BASE = `You are the TML Concierge — a discreet, points-savvy luxury travel advisor for the TML Network.
Voice: editorial, calm, concise. Never sycophantic, never use exclamation points. Speak like Monocle magazine.
Always cite *why* you recommend something: proximity to the traveler's anchor stay, points multiplier on their active cards, fit with their stated preferences, or timing within their itinerary.
When the traveler has an active trip, ground every answer in their itinerary, budget, and anchor stay. Never invent confirmation codes, prices, or availability.
Format responses in concise markdown. Use short paragraphs and tight bullet lists. Avoid headings unless the answer is long.

You have access to tools. **Prefer tools** over freeform answers when the question maps to a tool.
Tools never mutate the itinerary directly — they return proposals the traveler can apply with one tap. Your job is to call the right tool, then frame the result in 1–2 sentences.

Action tools:
- create_itinerary_item — schedule a concrete booking on the active trip. Use only when the user explicitly asks to add/schedule something.

Research tools:
- search_studio_items — search the traveler's saved Studio research vault.
- suggest_anchor — propose stays from the itinerary that could anchor the trip geographically.
- get_trip_summary — fetch live trip metrics (spend, item counts, dates).

Proposal tools (return a structured proposal; user clicks Apply):
- find_gaps — surface empty days, missing dining, or unfilled accommodation nights.
- optimize_loyalty — recommend the best card/program to earn on a given item or category + cost.
- optimize_route — re-order a specific day's items by proximity; returns proposed order.
- rebalance_budget — flag categories over/under target nightly budget.
- find_dining_near_anchor — surface dining options near the anchor stay (Studio + Places).
- summarize_day — narrate a focused day (morning/afternoon/evening) for the traveler.
- suggest_logistics — propose flights/trains/transfers between location legs that lack a transport item.

When you recommend specific venues, hotels, restaurants, or activities (without calling create_itinerary_item), append a structured suggestions block at the end. Wrap JSON in triple backticks with the language tag "suggestions". Example:
\`\`\`suggestions
[
  {"title": "The Ivy", "category": "dining", "location_name": "Mayfair, London", "description": "Classic British brasserie with a courtyard garden", "estimated_cost": 120, "target": "itinerary"},
  {"title": "Claridge's", "category": "stays", "location_name": "Brook Street, London", "description": "Art Deco landmark hotel", "estimated_cost": 850, "target": "studio"}
]
\`\`\`
Use category values: stays, dining, activity, logistics. Use target values: "studio" or "itinerary".`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_itinerary_item",
      description: "Schedule a concrete booking on the active trip.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: ["stays", "dining", "activity", "logistics", "sites_of_interest"] },
          date: { type: "string", description: "YYYY-MM-DD" },
          start_time: { type: "string", description: "HH:MM" },
          end_time: { type: "string", description: "HH:MM" },
          location_name: { type: "string" },
          description: { type: "string" },
          estimated_cost: { type: "number" },
          currency: { type: "string" },
        },
        required: ["title", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_studio_items",
      description: "Search the traveler's saved Studio research items by keyword.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free text search across title/description/location" },
          category: { type: "string", enum: ["stays", "dining", "activity", "logistics", "sites_of_interest"] },
          limit: { type: "number" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_anchor",
      description: "List candidate stays on the active trip that could serve as the geographic anchor.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trip_summary",
      description: "Live snapshot of active trip: dates, totals, anchor, item counts by category.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "find_gaps",
      description: "Detect empty days, missing dinners, and unfilled accommodation nights on the active trip. Returns a proposal the traveler can act on.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "optimize_loyalty",
      description: "Recommend the best card/loyalty program to earn on a given category + cost (or a specific itinerary item).",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["stays", "dining", "activity", "logistics", "sites_of_interest"] },
          cost: { type: "number" },
          currency: { type: "string" },
          item_id: { type: "string", description: "Optional: itinerary item id to optimize for." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "optimize_route",
      description: "Re-order items on a focused day by haversine proximity. Returns a proposed order without mutating the itinerary.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD. Defaults to the focused day or first day." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rebalance_budget",
      description: "Compare per-category spend vs. nightly target. Returns a proposal listing categories over/under and items to consider downgrading.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "find_dining_near_anchor",
      description: "Surface dining candidates near the active anchor stay from Studio research. Returns proposal cards.",
      parameters: {
        type: "object",
        properties: {
          radius_km: { type: "number", description: "Search radius in km. Default 5." },
          limit: { type: "number", description: "Max candidates. Default 5." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_day",
      description: "Narrate a single day of the trip in morning/afternoon/evening structure based on its scheduled items.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD. Defaults to the focused day." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_logistics",
      description: "Detect transitions between location legs without a transport item and propose flight/train/drive options.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { conversation_id, message, context, trip_id, stream } = body as {
      conversation_id?: string;
      message?: string;
      context?: Record<string, unknown>;
      trip_id?: string | null;
      stream?: boolean;
    };
    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve / create conversation
    let convId = conversation_id || null;
    if (!convId) {
      const title = message.trim().slice(0, 60);
      const { data: newConv, error: convErr } = await supabase
        .from("concierge_conversations")
        .insert({ user_id: user.id, trip_id: trip_id || null, title })
        .select("id")
        .single();
      if (convErr || !newConv) {
        console.error("conversation insert failed", convErr);
        return new Response(JSON.stringify({ error: "Could not start conversation" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      convId = newConv.id;
    } else {
      await supabase.from("concierge_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    }

    // Persist user message
    await supabase.from("concierge_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    // Load full thread (oldest first)
    const { data: history } = await supabase
      .from("concierge_messages")
      .select("role, content, tool_calls")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    const ctxBlock = buildContextBlock(context);
    const systemPrompt = ctxBlock ? `${SYSTEM_BASE}\n\n${ctxBlock}` : SYSTEM_BASE;

    // Build OpenAI-shape messages from DB rows
    type AiMsg = { role: string; content: string; tool_calls?: unknown; tool_call_id?: string; name?: string };
    const aiMessages: AiMsg[] = [{ role: "system", content: systemPrompt }];
    for (const m of history || []) {
      if (m.role === "tool") {
        // Stored as content+name in tool_calls JSON
        const tc = (m.tool_calls as { tool_call_id?: string; name?: string } | null) || {};
        aiMessages.push({ role: "tool", content: m.content || "", tool_call_id: tc.tool_call_id || "", name: tc.name || "" });
      } else if (m.role === "assistant" && m.tool_calls) {
        aiMessages.push({ role: "assistant", content: m.content || "", tool_calls: m.tool_calls });
      } else {
        aiMessages.push({ role: m.role, content: m.content || "" });
      }
    }

    /* ---------- Streaming branch ---------- */
    if (stream) {
      const encoder = new TextEncoder();
      const sseHeaders = {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      };

      const streamBody = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };

          try {
            send({ type: "conversation", conversation_id: convId });

            const executedTools: { name: string; args: Record<string, unknown>; result: unknown }[] = [];
            let finalContent = "";

            for (let iter = 0; iter < 4; iter++) {
              const isFinalIter = iter === 3;
              // First pass: non-streaming to detect tool calls; if no tool calls, re-issue as streaming.
              const probe = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: aiMessages,
                  tools: TOOLS,
                }),
              });
              if (!probe.ok) {
                const status = probe.status;
                send({ type: "error", status, error: status === 429 ? "Rate limit exceeded." : status === 402 ? "AI credits exhausted." : "AI service error" });
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();
                return;
              }
              const data = await probe.json();
              const choice = data.choices?.[0]?.message;
              const toolCalls = choice?.tool_calls;

              if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0 && !isFinalIter) {
                aiMessages.push({ role: "assistant", content: choice.content || "", tool_calls: toolCalls });
                const dbRows: Record<string, unknown>[] = [
                  { conversation_id: convId, user_id: user.id, role: "assistant", content: choice.content || "", tool_calls: toolCalls },
                ];
                for (const tc of toolCalls) {
                  const name = tc.function?.name as string;
                  let args: Record<string, unknown> = {};
                  try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
                  send({ type: "tool_call_start", id: tc.id, name, args });
                  const result = await executeTool(name, args, { supabase, userId: user.id, tripId: trip_id || null, context, lovableKey: LOVABLE_API_KEY });
                  executedTools.push({ name, args, result });
                  send({ type: "tool_call_result", id: tc.id, name, result });
                  aiMessages.push({
                    role: "tool",
                    content: JSON.stringify(result),
                    tool_call_id: tc.id,
                    name,
                  });
                  dbRows.push({
                    conversation_id: convId,
                    user_id: user.id,
                    role: "tool",
                    content: JSON.stringify(result),
                    tool_calls: { tool_call_id: tc.id, name, args },
                  });
                }
                await supabase.from("concierge_messages").insert(dbRows);
                continue;
              }

              // No more tool calls — stream the final answer
              const finalResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: aiMessages,
                  stream: true,
                }),
              });
              if (!finalResp.ok || !finalResp.body) {
                // Fallback: use the choice content we already have
                finalContent = choice?.content || "";
                if (finalContent) send({ type: "delta", content: finalContent });
                break;
              }
              const reader = finalResp.body.getReader();
              const decoder = new TextDecoder();
              let buf = "";
              let streamDone = false;
              while (!streamDone) {
                const { done: d, value } = await reader.read();
                if (d) break;
                buf += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = buf.indexOf("\n")) !== -1) {
                  let line = buf.slice(0, nl);
                  buf = buf.slice(nl + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
                  const payload = line.slice(6).trim();
                  if (payload === "[DONE]") { streamDone = true; break; }
                  try {
                    const parsed = JSON.parse(payload);
                    const c: string | undefined = parsed.choices?.[0]?.delta?.content;
                    if (c) {
                      finalContent += c;
                      send({ type: "delta", content: c });
                    }
                  } catch {
                    buf = line + "\n" + buf;
                    break;
                  }
                }
              }
              break;
            }

            // Persist final assistant message
            await supabase.from("concierge_messages").insert({
              conversation_id: convId,
              user_id: user.id,
              role: "assistant",
              content: finalContent,
              tool_calls: null,
            });
            send({ type: "done", content: finalContent });
          } catch (e) {
            console.error("concierge-chat stream error", e);
            send({ type: "error", error: e instanceof Error ? e.message : "Stream error" });
          } finally {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          }
        },
      });

      return new Response(streamBody, { headers: sseHeaders });
    }

    // Tool-call loop (max 4 iterations to avoid runaway)
    const executedTools: { name: string; args: Record<string, unknown>; result: unknown }[] = [];
    let finalContent = "";
    let finalAssistantToolCalls: unknown = null;
    for (let iter = 0; iter < 4; iter++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools: TOOLS,
        }),
      });
      if (!aiResp.ok) {
        if (aiResp.status === 429 || aiResp.status === 402) {
          return new Response(
            JSON.stringify({
              error: aiResp.status === 429 ? "Rate limit exceeded." : "AI credits exhausted.",
              conversation_id: convId,
            }),
            { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        console.error("AI gateway error", aiResp.status, await aiResp.text());
        return new Response(JSON.stringify({ error: "AI service error", conversation_id: convId }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await aiResp.json();
      const choice = data.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        aiMessages.push({ role: "assistant", content: choice.content || "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          const name = tc.function?.name as string;
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
          const result = await executeTool(name, args, { supabase, userId: user.id, tripId: trip_id || null, context, lovableKey: LOVABLE_API_KEY });
          executedTools.push({ name, args, result });
          aiMessages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: tc.id,
            name,
          });
        }
        // Persist this round
        await supabase.from("concierge_messages").insert([
          { conversation_id: convId, user_id: user.id, role: "assistant", content: choice.content || "", tool_calls: toolCalls },
          ...toolCalls.map((tc: { id: string; function: { name: string; arguments?: string } }, idx: number) => {
            const exec = executedTools[executedTools.length - toolCalls.length + idx];
            return {
              conversation_id: convId,
              user_id: user.id,
              role: "tool",
              content: JSON.stringify(exec.result),
              tool_calls: { tool_call_id: tc.id, name: tc.function?.name, args: exec.args },
            };
          }),
        ]);
        continue;
      }
      // Final answer
      finalContent = choice?.content || "";
      finalAssistantToolCalls = null;
      break;
    }

    // Persist final assistant message
    await supabase.from("concierge_messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "assistant",
      content: finalContent,
      tool_calls: finalAssistantToolCalls,
    });

    return new Response(
      JSON.stringify({ conversation_id: convId, content: finalContent, tool_results: executedTools }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("concierge-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/* ---------- Tool executor ---------- */
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { supabase: ReturnType<typeof createClient>; userId: string; tripId: string | null; context?: Record<string, unknown>; lovableKey?: string },
): Promise<unknown> {
  const { supabase, userId, tripId, context, lovableKey } = ctx;
  try {
    if (name === "create_itinerary_item") {
      if (!tripId) return { error: "No active trip. Ask the traveler to open a trip workspace first." };
      const insert = {
        trip_id: tripId,
        user_id: userId,
        title: String(args.title || "Untitled"),
        category: String(args.category || "activity"),
        date: (args.date as string) || null,
        start_time: (args.start_time as string) || null,
        end_time: (args.end_time as string) || null,
        location_name: (args.location_name as string) || null,
        description: (args.description as string) || null,
        cost: (args.estimated_cost as number | undefined) ?? null,
        currency: (args.currency as string) || "USD",
        approval_status: "draft",
      };
      const { data, error } = await supabase
        .from("itinerary_items")
        .insert(insert)
        .select("id, title, date, category")
        .single();
      if (error) return { error: error.message };
      return { ok: true, item: data };
    }
    if (name === "search_studio_items") {
      const q = String(args.query || "");
      const limit = Math.min(Number(args.limit || 8), 20);
      let query = supabase
        .from("studio_items")
        .select("id, title, category, address, description")
        .limit(limit);
      if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,address.ilike.%${q}%`);
      if (args.category) query = query.eq("category", String(args.category));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { items: data || [] };
    }
    if (name === "suggest_anchor") {
      if (!tripId) return { error: "No active trip." };
      const { data, error } = await supabase
        .from("itinerary_items")
        .select("id, title, location_name, date")
        .eq("trip_id", tripId)
        .eq("category", "stays")
        .order("date", { ascending: true });
      if (error) return { error: error.message };
      return { candidates: data || [] };
    }
    if (name === "get_trip_summary") {
      if (!tripId) return { error: "No active trip." };
      const [{ data: trip }, { data: items }] = await Promise.all([
        supabase.from("trips").select("name, destination, start_date, end_date, total_trip_budget").eq("id", tripId).maybeSingle(),
        supabase.from("itinerary_items").select("category, cost, date").eq("trip_id", tripId),
      ]);
      const totalSpend = (items || []).reduce((s, i) => s + (i.cost ? Number(i.cost) : 0), 0);
      const byCat: Record<string, number> = {};
      for (const i of items || []) byCat[i.category] = (byCat[i.category] || 0) + 1;
      return { trip, total_spend: totalSpend, item_counts: byCat };
    }
    if (name === "find_gaps") {
      if (!tripId) return { error: "No active trip." };
      return await toolFindGaps(supabase, tripId);
    }
    if (name === "optimize_loyalty") {
      return await toolOptimizeLoyalty(supabase, tripId, userId, args, context);
    }
    if (name === "optimize_route") {
      if (!tripId) return { error: "No active trip." };
      return await toolOptimizeRoute(supabase, tripId, args, context);
    }
    if (name === "rebalance_budget") {
      if (!tripId) return { error: "No active trip." };
      return await toolRebalanceBudget(supabase, tripId);
    }
    if (name === "find_dining_near_anchor") {
      if (!tripId) return { error: "No active trip." };
      return await toolFindDiningNearAnchor(supabase, tripId, userId, args, context);
    }
    if (name === "summarize_day") {
      if (!tripId) return { error: "No active trip." };
      return await toolSummarizeDay(supabase, tripId, args, context, lovableKey);
    }
    if (name === "suggest_logistics") {
      if (!tripId) return { error: "No active trip." };
      return await toolSuggestLogistics(supabase, tripId);
    }
    return { error: `Unknown tool: ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Tool execution failed" };
  }
}

function buildContextBlock(context: any): string {
  if (!context || typeof context !== "object") return "";
  const lines: string[] = [];
  const t = context.trip;
  if (t) {
    const parts = [t.name, t.destination, t.start_date && t.end_date ? `${t.start_date} → ${t.end_date}` : null]
      .filter(Boolean).join(" · ");
    lines.push(`[ACTIVE TRIP] ${parts}`);
    if (t.total_trip_budget) lines.push(`[BUDGET] Total ${t.total_trip_budget}, nightly target ${t.target_nightly_budget ?? "—"}`);
  }
  if (context.budget && typeof context.budget === "object") {
    const b = context.budget as Record<string, unknown>;
    const bits: string[] = [];
    if (b.total != null) bits.push(`total ${b.total}`);
    if (b.spent != null) bits.push(`spent ${b.spent}`);
    if (b.remaining != null) bits.push(`remaining ${b.remaining}`);
    if (b.currency) bits.push(String(b.currency));
    if (bits.length) lines.push(`[BUDGET SNAPSHOT] ${bits.join(" · ")}`);
  }
  if (context.anchor) {
    lines.push(`[ANCHOR STAY] ${context.anchor.title}${context.anchor.location_name ? ` — ${context.anchor.location_name}` : ""}`);
  }
  if (context.focused_date) {
    lines.push(`[FOCUSED DAY] ${context.focused_date}`);
  }
  if (Array.isArray(context.itinerary) && context.itinerary.length > 0) {
    const summary = context.itinerary.slice(0, 40)
      .map((i: any) => `- ${i.date || "unscheduled"} · ${i.category} · ${i.title}`)
      .join("\n");
    lines.push(`[ITINERARY]\n${summary}`);
  }
  if (context.preferences && typeof context.preferences === "object") {
    const p = context.preferences;
    const prefs: string[] = [];
    if (p.minReviewScore) prefs.push(`min review ${p.minReviewScore}`);
    if (p.hotelStarRating) prefs.push(`min ${p.hotelStarRating}★ hotels`);
    if (Array.isArray(p.loyaltyPrograms) && p.loyaltyPrograms.length) prefs.push(`loyalty: ${p.loyaltyPrograms.join(", ")}`);
    if (Array.isArray(p.creditCards) && p.creditCards.length) prefs.push(`cards: ${p.creditCards.join(", ")}`);
    if (Array.isArray(p.amenities) && p.amenities.length) prefs.push(`amenities: ${p.amenities.join(", ")}`);
    if (prefs.length) lines.push(`[PREFERENCES] ${prefs.join(" · ")}`);
  }
  if (Array.isArray(context.loyalty_cards) && context.loyalty_cards.length) {
    lines.push(`[LOYALTY WALLET] ${context.loyalty_cards.slice(0, 12).join(", ")}`);
  }
  if (Array.isArray(context.loyalty_programs) && context.loyalty_programs.length) {
    lines.push(`[LOYALTY PROGRAMS] ${context.loyalty_programs.slice(0, 12).join(", ")}`);
  }
  return lines.join("\n");
}