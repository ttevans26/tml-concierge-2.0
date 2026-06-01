import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, RotateCcw, Plus, Bookmark, CalendarDays } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/stores/useTripStore";
import { useStudioStore } from "@/stores/useStudioStore";
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

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
          ["studio", "itinerary"].includes(s.target)
      );
    }
  } catch {
    /* ignore malformed JSON */
  }
  return { text, suggestions };
}

function stripTrailingRule(text: string): string {
  return text.replace(/---\s*$/, "").trim();
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function GeminiFooter() {
  const [open, setOpen] = useState(false);
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

  const activeFolder = useStudioStore((s) => s.activeFolder);
  const addStudioItem = useStudioStore((s) => s.addItem);
  const fetchFolders = useStudioStore((s) => s.fetchFolders);

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

  /* ---- Actions ---- */

  async function handleAddToItinerary(suggestion: Suggestion, msgIndex: number) {
    if (!activeTrip) {
      toast({ title: "No active trip", description: "Open a trip workspace first.", variant: "destructive" });
      return;
    }
    const key = `${msgIndex}-${suggestion.title}`;
    setAddingIds((prev) => new Set(prev).add(key));

    const defaultDate = activeTrip.start_date || new Date().toISOString().slice(0, 10);
    const item = await createItineraryItem({
      trip_id: activeTrip.id,
      title: suggestion.title,
      category: suggestion.category,
      location_name: suggestion.location_name || null,
      description: suggestion.description || null,
      cost: suggestion.estimated_cost ? String(suggestion.estimated_cost) : null,
      date: defaultDate,
      approval_status: "draft",
    });

    setAddingIds((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (item) {
      toast({ title: "Added to itinerary", description: suggestion.title });
      fetchItineraryItems(activeTrip.id);
    } else {
      toast({ title: "Failed to add", description: "Please try again.", variant: "destructive" });
    }
  }

  async function handleAddToStudio(suggestion: Suggestion, msgIndex: number) {
    if (!activeFolder) {
      toast({ title: "No folder selected", description: "Open a collection in the Studio first.", variant: "destructive" });
      return;
    }
    const key = `${msgIndex}-${suggestion.title}`;
    setAddingIds((prev) => new Set(prev).add(key));

    const item = await addStudioItem(activeFolder.id, {
      title: suggestion.title,
      category: suggestion.category === "stays" ? "stays" : suggestion.category === "dining" ? "dining" : "activity",
      address: suggestion.location_name || null,
      description: suggestion.description || null,
      cost: suggestion.estimated_cost ? String(suggestion.estimated_cost) : null,
      url: null,
      lat: null,
      lng: null,
      google_place_id: null,
      source_url: null,
      api_metadata: {},
    });

    setAddingIds((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (item) {
      toast({ title: "Saved to Studio", description: `${suggestion.title} → ${activeFolder.name}` });
      fetchFolders();
    } else {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

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
            messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-[2px] px-3 py-2 bg-accent text-accent-foreground font-inter text-xs leading-relaxed">
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              }

              const { text, suggestions } = parseSuggestions(m.content);
              const displayText = stripTrailingRule(text);

              return (
                <div key={i} className="flex justify-start">
                  <div className="w-full max-w-[92%] space-y-2">
                    {/* Markdown text */}
                    <div className="rounded-[2px] bg-muted px-3 py-2 text-foreground">
                      <div className="prose prose-xs max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-foreground">
                        <ReactMarkdown>{displayText || "…"}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Suggestion cards */}
                    {suggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground px-0.5">
                          Suggested items
                        </p>
                        {suggestions.map((s, si) => {
                          const key = `${i}-${s.title}`;
                          const isAdding = addingIds.has(key);
                          return (
                            <div
                              key={si}
                              className="rounded-[2px] border border-border bg-background p-2.5 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-inter text-xs font-medium text-foreground truncate">
                                    {s.title}
                                  </p>
                                  {s.location_name && (
                                    <p className="font-inter text-[10px] text-muted-foreground truncate">
                                      {s.location_name}
                                    </p>
                                  )}
                                  {s.description && (
                                    <p className="font-inter text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                                      {s.description}
                                    </p>
                                  )}
                                  {s.estimated_cost && (
                                    <p className="font-inter text-[10px] text-accent mt-0.5">
                                      Est. ${s.estimated_cost}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-[2px] px-1.5 py-0.5 font-inter text-[10px] uppercase tracking-wider",
                                    s.category === "stays" && "bg-emerald-50 text-emerald-700",
                                    s.category === "dining" && "bg-amber-50 text-amber-700",
                                    s.category === "activity" && "bg-sky-50 text-sky-700",
                                    s.category === "logistics" && "bg-slate-50 text-slate-700"
                                  )}
                                >
                                  {s.category}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleAddToItinerary(s, i)}
                                  disabled={isAdding || !activeTrip}
                                  className={cn(
                                    "flex items-center gap-1 rounded-[2px] px-2 py-1 font-inter text-[10px] transition-colors",
                                    activeTrip
                                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                                      : "bg-muted text-muted-foreground cursor-not-allowed"
                                  )}
                                >
                                  {isAdding ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <CalendarDays className="h-2.5 w-2.5" />
                                  )}
                                  Add to Itinerary
                                </button>
                                <button
                                  onClick={() => handleAddToStudio(s, i)}
                                  disabled={isAdding}
                                  className={cn(
                                    "flex items-center gap-1 rounded-[2px] px-2 py-1 font-inter text-[10px] transition-colors border",
                                    activeFolder
                                      ? "border-border bg-background text-foreground hover:bg-muted"
                                      : "border-border bg-muted text-muted-foreground cursor-not-allowed"
                                  )}
                                >
                                  {isAdding ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Bookmark className="h-2.5 w-2.5" />
                                  )}
                                  Save to Studio
                                  {activeFolder && (
                                    <span className="text-muted-foreground">· {activeFolder.name}</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
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
