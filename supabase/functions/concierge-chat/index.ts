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

/* ============================================================
 *  Tool implementations (Phase 2)
 *  Every tool returns a payload with a `proposal` field so the
 *  client can render a structured ProposalCard. None of these
 *  mutate the database — they propose only.
 * ============================================================ */

type SB = ReturnType<typeof createClient>;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ---- find_gaps ---- */
async function toolFindGaps(supabase: SB, tripId: string) {
  const [{ data: trip }, { data: items }] = await Promise.all([
    supabase.from("trips").select("start_date, end_date").eq("id", tripId).maybeSingle(),
    supabase
      .from("itinerary_items")
      .select("id, category, date, start_time, end_time, title, metadata")
      .eq("trip_id", tripId),
  ]);
  if (!trip?.start_date || !trip?.end_date) return { error: "Trip dates not set." };
  const days = eachDay(trip.start_date, trip.end_date);
  const byDay = new Map<string, typeof items>();
  for (const i of items || []) {
    if (!i.date) continue;
    if (!byDay.has(i.date)) byDay.set(i.date, []);
    byDay.get(i.date)!.push(i);
  }
  // Expand multi-night stays across every night they cover (mirrors Matrix Grid).
  const staysByNight = new Set<string>();
  for (const i of items || []) {
    if (i.category !== "stays" || !i.date) continue;
    const meta = (i as { metadata?: Record<string, unknown> }).metadata || {};
    const metaEnd = typeof meta.end_date === "string" ? (meta.end_date as string) : null;
    try {
      const start = new Date(i.date + "T00:00:00Z");
      let nights = 1;
      if (metaEnd && metaEnd >= i.date) {
        const end = new Date(metaEnd + "T00:00:00Z");
        nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      }
      for (let n = 0; n < nights; n++) {
        const d = new Date(start.getTime() + n * 86400000);
        staysByNight.add(d.toISOString().slice(0, 10));
      }
    } catch {
      staysByNight.add(i.date);
    }
  }
  const gaps: { date: string; type: "empty_day" | "missing_dinner" | "no_stay"; note: string }[] = [];
  for (const d of days) {
    const dayItems = byDay.get(d) || [];
    const hasStay = staysByNight.has(d);
    const hasDinner = dayItems.some(
      (i) => i.category === "dining" && i.start_time && i.start_time >= "17:00" && i.start_time <= "22:30",
    );
    const nonStay = dayItems.filter((i) => i.category !== "stays" && i.category !== "location");
    if (nonStay.length === 0) {
      gaps.push({ date: d, type: "empty_day", note: "No activities, dining, or logistics scheduled." });
    } else if (!hasDinner && dayItems.some((i) => i.category === "dining" || i.category === "activity")) {
      gaps.push({ date: d, type: "missing_dinner", note: "No dinner reservation between 17:00 and 22:30." });
    }
    if (!hasStay) {
      gaps.push({ date: d, type: "no_stay", note: "No accommodation for this night." });
    }
  }
  return {
    proposal: {
      type: "find_gaps",
      trip_id: tripId,
      total_days: days.length,
      gaps,
    },
  };
}

/* ---- optimize_loyalty ---- */
const CARD_MULTIPLIERS: { match: RegExp; rules: { category: string; mult: number; label: string }[] }[] = [
  {
    match: /amex.*platinum/i,
    rules: [
      { category: "stays", mult: 5, label: "5x on prepaid hotels via Amex Travel" },
      { category: "logistics", mult: 5, label: "5x on flights booked direct or via Amex Travel" },
      { category: "dining", mult: 1, label: "1x base" },
      { category: "activity", mult: 1, label: "1x base" },
    ],
  },
  {
    match: /amex.*gold/i,
    rules: [
      { category: "dining", mult: 4, label: "4x at restaurants worldwide" },
      { category: "stays", mult: 3, label: "3x on flights & 2x on prepaid hotels" },
      { category: "logistics", mult: 3, label: "3x on flights direct" },
      { category: "activity", mult: 1, label: "1x base" },
    ],
  },
  {
    match: /chase.*sapphire.*reserve/i,
    rules: [
      { category: "logistics", mult: 5, label: "5x on flights via Chase Travel" },
      { category: "stays", mult: 10, label: "10x on hotels via Chase Travel" },
      { category: "dining", mult: 3, label: "3x on dining worldwide" },
      { category: "activity", mult: 3, label: "3x on travel & tours" },
    ],
  },
  {
    match: /chase.*sapphire.*preferred/i,
    rules: [
      { category: "stays", mult: 5, label: "5x on hotels via Chase Travel" },
      { category: "dining", mult: 3, label: "3x on dining" },
      { category: "logistics", mult: 2, label: "2x on travel" },
      { category: "activity", mult: 2, label: "2x on travel" },
    ],
  },
  {
    match: /capital one.*venture x/i,
    rules: [
      { category: "stays", mult: 10, label: "10x on hotels via Capital One Travel" },
      { category: "logistics", mult: 5, label: "5x on flights via Capital One Travel" },
      { category: "dining", mult: 2, label: "2x base" },
      { category: "activity", mult: 2, label: "2x base" },
    ],
  },
];

async function toolOptimizeLoyalty(
  supabase: SB,
  tripId: string | null,
  _userId: string,
  args: Record<string, unknown>,
  context?: Record<string, unknown>,
) {
  let category = String(args.category || "");
  let cost = Number(args.cost || 0);
  const itemId = args.item_id ? String(args.item_id) : null;
  if (itemId) {
    const { data: item } = await supabase
      .from("itinerary_items")
      .select("category, cost, currency, title")
      .eq("id", itemId)
      .maybeSingle();
    if (item) {
      category = category || item.category;
      cost = cost || Number(item.cost || 0);
    }
  }
  if (!category) return { error: "Need a category to optimize for." };

  const ctxCards = Array.isArray((context as any)?.loyalty_cards) ? ((context as any).loyalty_cards as string[]) : [];
  const ctxPrograms = Array.isArray((context as any)?.loyalty_programs) ? ((context as any).loyalty_programs as string[]) : [];

  const ranked: { card: string; multiplier: number; rationale: string; est_points: number }[] = [];
  for (const card of ctxCards) {
    const profile = CARD_MULTIPLIERS.find((p) => p.match.test(card));
    if (!profile) {
      ranked.push({ card, multiplier: 1, rationale: "No known category bonus (base 1x)", est_points: Math.round(cost) });
      continue;
    }
    const rule = profile.rules.find((r) => r.category === category) || { mult: 1, label: "1x base" };
    ranked.push({
      card,
      multiplier: rule.mult,
      rationale: rule.label,
      est_points: Math.round(cost * rule.mult),
    });
  }
  ranked.sort((a, b) => b.est_points - a.est_points);

  return {
    proposal: {
      type: "optimize_loyalty",
      category,
      cost,
      currency: String(args.currency || "USD"),
      recommended: ranked[0] || null,
      alternatives: ranked.slice(1, 4),
      loyalty_programs: ctxPrograms,
      item_id: itemId,
    },
  };
}

/* ---- optimize_route ---- */
async function toolOptimizeRoute(
  supabase: SB,
  tripId: string,
  args: Record<string, unknown>,
  context?: Record<string, unknown>,
) {
  const date =
    (args.date as string) ||
    ((context as any)?.focused_date as string) ||
    null;
  if (!date) return { error: "Need a date. Ask the traveler which day to optimize." };

  const { data: items } = await supabase
    .from("itinerary_items")
    .select("id, title, category, start_time, end_time, location_lat, location_lng, location_name")
    .eq("trip_id", tripId)
    .eq("date", date)
    .order("start_time", { ascending: true });

  const routable = (items || []).filter(
    (i) => i.category !== "stays" && i.category !== "location" && i.location_lat != null && i.location_lng != null,
  );
  if (routable.length < 2) {
    return { error: "Need at least 2 items with coordinates on this day to optimize." };
  }

  // Anchor stay if available
  const anchorLat = (context as any)?.anchor?.location_lat as number | undefined;
  const anchorLng = (context as any)?.anchor?.location_lng as number | undefined;
  let start = { lat: routable[0].location_lat!, lng: routable[0].location_lng! };
  if (typeof anchorLat === "number" && typeof anchorLng === "number") {
    start = { lat: anchorLat, lng: anchorLng };
  }

  // Nearest-neighbor TSP
  const remaining = [...routable];
  const ordered: typeof routable = [];
  let cur = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i];
      const d = haversineKm(cur, { lat: r.location_lat!, lng: r.location_lng! });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    cur = { lat: next.location_lat!, lng: next.location_lng! };
  }

  let prev = start;
  const sequence = ordered.map((item) => {
    const distKm = haversineKm(prev, { lat: item.location_lat!, lng: item.location_lng! });
    prev = { lat: item.location_lat!, lng: item.location_lng! };
    return {
      item_id: item.id,
      title: item.title,
      category: item.category,
      location_name: item.location_name,
      distance_km: Math.round(distKm * 10) / 10,
      // very rough transit estimate: 30 km/h average urban + 5 min buffer
      transit_minutes: Math.round((distKm / 30) * 60) + 5,
    };
  });

  return {
    proposal: {
      type: "optimize_route",
      date,
      sequence,
      anchored_to_stay: typeof anchorLat === "number",
      skipped_items: (items || [])
        .filter((i) => i.category !== "stays" && i.category !== "location" && (i.location_lat == null || i.location_lng == null))
        .map((i) => ({ id: i.id, title: i.title })),
    },
  };
}

/* ---- rebalance_budget ---- */
async function toolRebalanceBudget(supabase: SB, tripId: string) {
  const [{ data: trip }, { data: items }] = await Promise.all([
    supabase
      .from("trips")
      .select("start_date, end_date, total_trip_budget, target_nightly_budget, display_currency")
      .eq("id", tripId)
      .maybeSingle(),
    supabase
      .from("itinerary_items")
      .select("id, title, category, cost, date")
      .eq("trip_id", tripId),
  ]);
  if (!trip) return { error: "Trip not found." };

  const nights =
    trip.start_date && trip.end_date
      ? Math.max(1, eachDay(trip.start_date, trip.end_date).length)
      : 1;
  const target = Number(trip.target_nightly_budget || 0);
  const totalTarget = target * nights;

  const byCat: Record<string, { total: number; items: { id: string; title: string; cost: number }[] }> = {};
  let grandTotal = 0;
  for (const i of items || []) {
    const c = Number(i.cost || 0);
    grandTotal += c;
    if (!byCat[i.category]) byCat[i.category] = { total: 0, items: [] };
    byCat[i.category].total += c;
    if (c > 0) byCat[i.category].items.push({ id: i.id, title: i.title, cost: c });
  }

  // Rough fair-share allocation across known categories
  const SHARES: Record<string, number> = { stays: 0.45, dining: 0.2, activity: 0.15, logistics: 0.15, sites_of_interest: 0.05 };
  const breakdown = Object.entries(SHARES).map(([cat, share]) => {
    const spent = byCat[cat]?.total || 0;
    const allocation = totalTarget * share;
    const over = spent - allocation;
    const topItems = (byCat[cat]?.items || []).sort((a, b) => b.cost - a.cost).slice(0, 3);
    return {
      category: cat,
      spent: Math.round(spent),
      allocation: Math.round(allocation),
      over_by: Math.round(over),
      status: over > allocation * 0.1 ? "over" : over < -allocation * 0.1 ? "under" : "on_track",
      top_items: topItems,
    };
  });

  return {
    proposal: {
      type: "rebalance_budget",
      currency: trip.display_currency || "USD",
      nights,
      total_budget: totalTarget || trip.total_trip_budget || 0,
      total_spent: Math.round(grandTotal),
      remaining: Math.round((totalTarget || Number(trip.total_trip_budget || 0)) - grandTotal),
      breakdown,
    },
  };
}

/* ---- find_dining_near_anchor ---- */
async function toolFindDiningNearAnchor(
  supabase: SB,
  _tripId: string,
  _userId: string,
  args: Record<string, unknown>,
  context?: Record<string, unknown>,
) {
  const anchor = (context as any)?.anchor;
  const lat = anchor?.location_lat as number | undefined;
  const lng = anchor?.location_lng as number | undefined;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { error: "No active anchor with coordinates. Ask the traveler to set an Anchor stay first." };
  }
  const radiusKm = Math.max(0.5, Math.min(Number(args.radius_km || 5), 25));
  const limit = Math.max(1, Math.min(Number(args.limit || 5), 10));

  const { data: studio } = await supabase
    .from("studio_items")
    .select("id, title, address, description, lat, lng, google_place_id, api_metadata")
    .eq("category", "dining")
    .not("lat", "is", null)
    .not("lng", "is", null);

  const ranked = (studio || [])
    .map((s) => ({
      ...s,
      distance_km: haversineKm({ lat, lng }, { lat: s.lat as number, lng: s.lng as number }),
    }))
    .filter((s) => s.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);

  const candidates = ranked.map((s) => ({
    studio_item_id: s.id,
    title: s.title,
    address: s.address,
    description: s.description,
    google_place_id: s.google_place_id,
    distance_km: Math.round(s.distance_km * 10) / 10,
    rating: (s.api_metadata as any)?.rating ?? null,
  }));

  return {
    proposal: {
      type: "find_dining_near_anchor",
      anchor: { title: anchor.title, location_name: anchor.location_name },
      radius_km: radiusKm,
      candidates,
    },
  };
}

/* ---- summarize_day ---- */
async function toolSummarizeDay(
  supabase: SB,
  tripId: string,
  args: Record<string, unknown>,
  context?: Record<string, unknown>,
  lovableKey?: string,
) {
  const date = (args.date as string) || ((context as any)?.focused_date as string);
  if (!date) return { error: "Need a date to summarize. Ask the traveler which day." };
  const { data: items } = await supabase
    .from("itinerary_items")
    .select("title, category, start_time, end_time, location_name, description, cost, currency")
    .eq("trip_id", tripId)
    .eq("date", date)
    .order("start_time", { ascending: true });

  if (!items || items.length === 0) {
    return {
      proposal: {
        type: "summarize_day",
        date,
        narrative: "_No items scheduled for this day yet._",
      },
    };
  }

  // Optionally call the model for narrative; fall back to deterministic if no key
  let narrative = "";
  if (lovableKey) {
    try {
      const prompt = `Narrate this day for a luxury traveler in 3 short paragraphs (Morning / Afternoon / Evening). Quiet Monocle voice, no exclamation points.\n\nDate: ${date}\nItems:\n${items
        .map(
          (i) =>
            `- ${i.start_time || "—"} ${i.category} · ${i.title}${i.location_name ? ` (${i.location_name})` : ""}`,
        )
        .join("\n")}`;
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        narrative = json.choices?.[0]?.message?.content || "";
      }
    } catch {
      /* fall through */
    }
  }
  if (!narrative) {
    narrative = items
      .map((i) => `- **${i.start_time || "—"}** ${i.title}${i.location_name ? ` · ${i.location_name}` : ""}`)
      .join("\n");
  }

  return {
    proposal: {
      type: "summarize_day",
      date,
      narrative,
    },
  };
}

/* ---- suggest_logistics ---- */
async function toolSuggestLogistics(supabase: SB, tripId: string) {
  const { data: items } = await supabase
    .from("itinerary_items")
    .select("id, category, date, location_name, location_lat, location_lng, title")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  // Build leg sequence: pick a representative location per date (first stay or first location item)
  const byDate = new Map<string, typeof items>();
  for (const i of items || []) {
    if (!i.date) continue;
    if (!byDate.has(i.date)) byDate.set(i.date, []);
    byDate.get(i.date)!.push(i);
  }
  const dates = [...byDate.keys()].sort();

  const locFor = (d: string) => {
    const arr = byDate.get(d) || [];
    const stay = arr.find((i) => i.category === "stays" && i.location_name);
    const loc = arr.find((i) => i.category === "location" && i.location_name);
    return stay || loc || arr.find((i) => i.location_name);
  };

  const gaps: {
    from_date: string;
    to_date: string;
    from_location: string | null;
    to_location: string | null;
    distance_km: number | null;
    options: { mode: "flight" | "train" | "drive"; label: string; rough_duration: string; cost_band: string }[];
  }[] = [];

  for (let idx = 1; idx < dates.length; idx++) {
    const prev = dates[idx - 1];
    const curr = dates[idx];
    const a = locFor(prev);
    const b = locFor(curr);
    if (!a || !b) continue;
    if (!a.location_name || !b.location_name) continue;
    if (a.location_name === b.location_name) continue;

    // Already a transport item between prev and curr?
    const hasTransport =
      (byDate.get(prev) || []).some((i) => i.category === "logistics") ||
      (byDate.get(curr) || []).some((i) => i.category === "logistics");
    if (hasTransport) continue;

    let distance: number | null = null;
    if (a.location_lat && a.location_lng && b.location_lat && b.location_lng) {
      distance = Math.round(
        haversineKm(
          { lat: a.location_lat, lng: a.location_lng },
          { lat: b.location_lat, lng: b.location_lng },
        ),
      );
    }

    const options: { mode: "flight" | "train" | "drive"; label: string; rough_duration: string; cost_band: string }[] = [];
    if (distance == null || distance > 400) {
      options.push({ mode: "flight", label: `Flight ${a.location_name} → ${b.location_name}`, rough_duration: distance ? `${Math.max(1, Math.round(distance / 700))}h flight + airport time` : "Varies", cost_band: "$$–$$$" });
    }
    if (distance != null && distance <= 600) {
      options.push({ mode: "train", label: `Train ${a.location_name} → ${b.location_name}`, rough_duration: `${Math.max(1, Math.round(distance / 200))}h rail`, cost_band: "$–$$" });
    }
    if (distance != null && distance <= 350) {
      options.push({ mode: "drive", label: `Private transfer ${a.location_name} → ${b.location_name}`, rough_duration: `${Math.max(1, Math.round(distance / 80))}h drive`, cost_band: "$$" });
    }
    if (options.length === 0) {
      options.push({ mode: "flight", label: `Flight ${a.location_name} → ${b.location_name}`, rough_duration: "Varies", cost_band: "$$" });
    }

    gaps.push({
      from_date: prev,
      to_date: curr,
      from_location: a.location_name,
      to_location: b.location_name,
      distance_km: distance,
      options,
    });
  }

  return {
    proposal: {
      type: "suggest_logistics",
      gaps,
    },
  };
}