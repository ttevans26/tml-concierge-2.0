import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, RotateCcw, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/useTripStore";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

interface Suggestion {
  title: string;
  category: "stays" | "dining" | "activity" | "logistics";
  location_name?: string;
  description?: string;
  estimated_cost?: number;
  target: "studio" | "itinerary";
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/concierge-chat`;

function parseSuggestions(content: string): { text: string; suggestions: Suggestion[] } {
  const regex = /```suggestions\s*([\s\S]*?)\s*```/;
  const match = content.match(regex);
  if (!match) return { text: content, suggestions: [] };
  const text = content.replace(match[0], "").trim();
  let suggestions: Suggestion[] = [];
  try {
    const parsed = JSON.parse(match[1].trim());
    if (Array.isArray(parsed)) {
      suggestions = parsed.filter(
        (s): s is Suggestion =>
          typeof s.title === "string" &&
          ["stays", "dining", "activity", "logistics"].includes(s.category) &&
          ["studio", "itinerary"].includes(s.target),
      );
    }
  } catch {
    /* ignore */
  }
  return { text, suggestions };
}

export default function ConciergePanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const profile = useTripStore((s) => s.profile);
  const activeAnchor = useTripStore((s) => s.activeAnchor);
  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const fetchItineraryItems = useTripStore((s) => s.fetchItineraryItems);
  const pendingConciergePrompt = useTripStore((s) => s.pendingConciergePrompt);
  const consumeConciergePrompt = useTripStore((s) => s.consumeConciergePrompt);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  // Cross-component prompt injection (e.g. from TripHealthBar "Ask concierge")
  useEffect(() => {
    if (pendingConciergePrompt && !streaming) {
      const p = consumeConciergePrompt();
      if (p) send(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConciergePrompt]);

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
      itinerary: itineraryItems.map((i) => ({ category: i.category, title: i.title, date: i.date })),
      preferences: (profile?.preferences as Record<string, unknown>) ?? {},
    };
  }

  const quickPrompts = [
    "What's missing from this itinerary?",
    activeAnchor ? `Dining near ${activeAnchor.title}` : "Standout dinner ideas",
    "Points-optimization plays I'm missing",
  ];

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
        if (resp.status === 429)
          toast({ title: "Rate limit reached", description: "Give the concierge a moment.", variant: "destructive" });
        else if (resp.status === 402)
          toast({ title: "AI credits exhausted", description: "Add funds in Settings → Workspace → Usage.", variant: "destructive" });
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
          if (jsonStr === "[DONE]") {
            done = true;
            break;
          }
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

  async function handleAddToItinerary(suggestion: Suggestion, msgIndex: number) {
    if (!activeTrip) return;
    const key = `${msgIndex}-${suggestion.title}`;
    setAddingIds((prev) => new Set(prev).add(key));
    const defaultDate = activeTrip.start_date || new Date().toISOString().slice(0, 10);
    const item = await createItineraryItem({
      trip_id: activeTrip.id,
      title: suggestion.title,
      category: suggestion.category,
      location_name: suggestion.location_name || null,
      description: suggestion.description || null,
      cost: suggestion.estimated_cost ?? null,
      date: defaultDate,
      approval_status: "draft",
    });
    setAddingIds((prev) => {
      const n = new Set(prev);
      n.delete(key);
      return n;
    });
    if (item) {
      toast({ title: "Added to itinerary", description: suggestion.title });
      fetchItineraryItems(activeTrip.id);
    }
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <p className="font-playfair text-[13px] font-semibold text-foreground">Concierge</p>
          {activeTrip && (
            <span className="font-inter text-[10px] text-muted-foreground truncate max-w-[120px]">
              · {activeTrip.destination || activeTrip.name}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="New conversation"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="font-inter text-[11px] leading-relaxed text-muted-foreground">
              Grounded in this trip. Ask about gaps, recs, or points strategy.
            </p>
            <div className="space-y-1">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="block w-full rounded-[2px] border border-border bg-background px-2.5 py-1.5 text-left font-inter text-[11px] text-foreground hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[90%] rounded-[2px] bg-accent px-2.5 py-1.5 font-inter text-[11px] leading-relaxed text-accent-foreground whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              );
            }
            const { text, suggestions } = parseSuggestions(m.content);
            return (
              <div key={i} className="space-y-2">
                <div className="rounded-[2px] bg-muted px-2.5 py-1.5">
                  <div className="prose prose-xs max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 text-foreground font-inter text-[11px] leading-relaxed">
                    <ReactMarkdown>{text || "…"}</ReactMarkdown>
                  </div>
                </div>
                {suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    {suggestions.map((s, si) => {
                      const key = `${i}-${s.title}`;
                      const isAdding = addingIds.has(key);
                      return (
                        <div
                          key={si}
                          className="rounded-[2px] border border-border bg-background p-2 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="font-inter text-[11px] font-medium text-foreground line-clamp-2">
                              {s.title}
                            </p>
                            <span
                              className={cn(
                                "shrink-0 rounded-[2px] px-1 py-0.5 font-inter text-[9px] uppercase tracking-wider",
                                s.category === "stays" && "bg-emerald-50 text-emerald-700",
                                s.category === "dining" && "bg-amber-50 text-amber-700",
                                s.category === "activity" && "bg-sky-50 text-sky-700",
                                s.category === "logistics" && "bg-slate-50 text-slate-700",
                              )}
                            >
                              {s.category}
                            </span>
                          </div>
                          {s.location_name && (
                            <p className="font-inter text-[10px] text-muted-foreground truncate">
                              {s.location_name}
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isAdding || !activeTrip}
                            onClick={() => handleAddToItinerary(s, i)}
                            className="h-6 w-full gap-1 rounded-[2px] font-inter text-[10px]"
                          >
                            {isAdding ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            Add to itinerary
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
        {streaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-inter text-[11px]">Thinking…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        className="flex shrink-0 items-center gap-1.5 border-t border-border bg-background/50 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the concierge…"
          disabled={streaming}
          className="flex-1 rounded-[2px] border border-border bg-background px-2 py-1.5 font-inter text-[11px] text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={streaming || !input.trim()}
          className="h-7 w-7 rounded-[2px] bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </div>
  );
}