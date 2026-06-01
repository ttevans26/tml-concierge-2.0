import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/useTripStore";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/concierge-chat`;

export default function GeminiFooter() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const profile = useTripStore((s) => s.profile);
  const activeAnchor = useTripStore((s) => s.activeAnchor);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const quickPrompts = activeTrip
    ? [
        "What's missing from this itinerary?",
        activeAnchor ? `Suggest a dinner near ${activeAnchor.title}` : "Suggest a standout dinner",
        "Any points-optimization plays I'm missing?",
      ]
    : [
        "Help me plan a long weekend in Lisbon",
        "Best use of Amex Platinum points this fall",
        "Quiet luxury hotels in Tokyo under $800/night",
      ];

  function buildContext() {
    return {
      trip: activeTrip
        ? {
            name: activeTrip.name,
            destination: activeTrip.destination,
            start_date: activeTrip.start_date,
            end_date: activeTrip.end_date,
            total_trip_budget: activeTrip.total_trip_budget,
            target_nightly_budget: activeTrip.target_nightly_budget,
          }
        : null,
      anchor: activeAnchor
        ? { title: activeAnchor.title, location_name: activeAnchor.location_name }
        : null,
      itinerary: itineraryItems.map((i) => ({
        category: i.category,
        title: i.title,
        date: i.date,
      })),
      preferences: (profile?.preferences as Record<string, unknown>) ?? {},
    };
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantSoFar = "";
    const pushAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, context: buildContext() }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast({ title: "Rate limit reached", description: "Give the concierge a moment, then try again.", variant: "destructive" });
        else if (resp.status === 402) toast({ title: "AI credits exhausted", description: "Add funds in Settings → Workspace → Usage.", variant: "destructive" });
        else toast({ title: "Concierge unavailable", description: "Please try again shortly.", variant: "destructive" });
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
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
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content: string | undefined = parsed.choices?.[0]?.delta?.content;
            if (content) pushAssistant(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast({ title: "Concierge error", description: "Connection interrupted.", variant: "destructive" });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
  }

  return (
    <>
      {/* Sticky Footer */}
      <footer className="sticky bottom-0 z-30 flex h-10 items-center justify-between border-t border-border bg-background/95 px-6 backdrop-blur-sm">
        <p className="font-inter text-[10px] text-muted-foreground tracking-wide">
          © {new Date().getFullYear()} TML Network
        </p>

        <Button
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="gap-1.5 rounded-[2px] bg-accent text-accent-foreground font-inter text-xs hover:bg-accent/90 shadow-sm min-h-[44px] sm:min-h-0"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
          Gemini Concierge
        </Button>
      </footer>

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed z-50 flex flex-col rounded-[2px] border border-border bg-card shadow-xl transition-all duration-200",
          "bottom-14 right-6 w-[380px] h-[560px] max-h-[calc(100vh-5rem)]",
          "max-sm:left-2 max-sm:right-2 max-sm:bottom-12 max-sm:w-auto max-sm:h-[70vh]",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <p className="font-playfair text-sm font-semibold text-foreground">Gemini Concierge</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="rounded-[2px] p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="New conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded-[2px] p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="font-inter text-xs leading-relaxed text-muted-foreground">
                {activeTrip
                  ? `Grounded in your ${activeTrip.destination ?? "trip"} itinerary. Ask anything — recommendations, gap analysis, points strategy.`
                  : "I'm your travel advisor. Ask about destinations, hotels, points strategy, or itinerary ideas."}
              </p>
              <div className="space-y-1.5">
                {quickPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="block w-full rounded-[2px] border border-border bg-background px-3 py-2 text-left font-inter text-xs text-foreground hover:border-accent hover:bg-accent/5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "font-inter text-xs leading-relaxed",
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-[2px] px-3 py-2",
                    m.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-foreground">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {streaming && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-[2px] bg-muted px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t border-border p-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the concierge…"
            className="flex-1 rounded-[2px] border border-border bg-background px-3 py-2 font-inter text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
            disabled={streaming}
          />
          <Button
            type="submit"
            size="sm"
            disabled={streaming || !input.trim()}
            className="rounded-[2px] bg-accent text-accent-foreground hover:bg-accent/90 h-9 w-9 p-0"
          >
            {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </>
  );
}
