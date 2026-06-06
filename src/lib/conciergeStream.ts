import { supabase } from "@/integrations/supabase/client";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/concierge-chat`;

export type ConciergeStreamEvent =
  | { type: "conversation"; conversation_id: string }
  | { type: "tool_call_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_call_result"; id: string; name: string; result: unknown }
  | { type: "delta"; content: string }
  | { type: "done"; content: string }
  | { type: "error"; status?: number; error: string };

export interface StreamConciergeOpts {
  message: string;
  conversation_id?: string | null;
  trip_id?: string | null;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
  onEvent: (e: ConciergeStreamEvent) => void;
}

/**
 * Single shared SSE client for the concierge edge function.
 * Used by both ConciergePanel (workspace right) and GeminiFooter (floating).
 */
export async function streamConcierge(opts: StreamConciergeOpts): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    opts.onEvent({ type: "error", status: 401, error: "Not signed in" });
    return;
  }

  let resp: Response;
  try {
    resp = await fetch(ENDPOINT, {
      method: "POST",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        message: opts.message,
        conversation_id: opts.conversation_id || null,
        trip_id: opts.trip_id || null,
        context: opts.context || {},
        stream: true,
      }),
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return;
    opts.onEvent({ type: "error", error: e instanceof Error ? e.message : "Network error" });
    return;
  }

  if (!resp.ok || !resp.body) {
    let errMsg = "Concierge unavailable";
    try {
      const j = await resp.json();
      errMsg = (j as { error?: string }).error || errMsg;
    } catch { /* ignore */ }
    opts.onEvent({ type: "error", status: resp.status, error: errMsg });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finalText = "";
  let sawDone = false;
  let done = false;

  try {
    while (!done) {
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
        if (payload === "[DONE]") { done = true; break; }
        try {
          const parsed = JSON.parse(payload) as ConciergeStreamEvent;
          opts.onEvent(parsed);
          if (parsed.type === "delta") finalText += parsed.content;
          if (parsed.type === "done") { finalText = parsed.content || finalText; sawDone = true; }
        } catch {
          buf = line + "\n" + buf;
          break;
        }
      }
    }
  } catch (e) {
    if ((e as { name?: string })?.name !== "AbortError") {
      opts.onEvent({ type: "error", error: e instanceof Error ? e.message : "Stream error" });
    }
    return;
  }

  if (!sawDone) opts.onEvent({ type: "done", content: finalText });
}