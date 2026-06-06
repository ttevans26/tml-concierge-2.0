import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Sparkles, X, Loader2, RotateCcw, Bookmark, CalendarDays, Wrench, CheckCircle2 } from "lucide-react";
const ReactMarkdown = lazy(() => import("react-markdown"));
import { cn } from "@/lib/utils";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";
import { useTripStore, selectTotalReservedCost, selectRemainingBudget } from "@/stores/useTripStore";
import { useStudioStore } from "@/stores/useStudioStore";
import { toast } from "@/hooks/use-toast";
import { streamConcierge } from "@/lib/conciergeStream";

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; toolId: string; name: string; args: Record<string, unknown>; result?: unknown; pending: boolean };

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
  const [hasOpened, setHasOpened] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const profile = useTripStore((s) => s.profile);
  const activeAnchor = useTripStore((s) => s.activeAnchor);
  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const fetchItineraryItems = useTripStore((s) => s.fetchItineraryItems);
  const totalSpent = useTripStore(selectTotalReservedCost);
  const remaining = useTripStore(selectRemainingBudget);

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
    const cards = Array.isArray(profile?.active_cards) ? (profile?.active_cards as unknown[]).map(String) : [];
    const loyalty = Array.isArray(profile?.loyalty_memberships) ? (profile?.loyalty_memberships as unknown[]).map(String) : [];
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
      budget: activeTrip
        ? {
            total: activeTrip.total_trip_budget,
            spent: totalSpent,
            remaining,
            currency: activeTrip.display_currency || "USD",
          }
        : null,
      anchor: activeAnchor
        ? {
            title: activeAnchor.title,
            location_name: activeAnchor.location_name,
            location_lat: activeAnchor.location_lat,
            location_lng: activeAnchor.location_lng,
          }
        : null,
      itinerary: itineraryItems.map((i) => ({
        category: i.category,
        title: i.title,
        date: i.date,
      })),
      preferences: (profile?.preferences as Record<string, unknown>) ?? {},
      loyalty_cards: cards,
      loyalty_programs: loyalty,
    };
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
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
      await streamConcierge({
        message: trimmed,
        conversation_id: conversationId,
        trip_id: activeTrip?.id || null,
        context: buildContext(),
        signal: controller.signal,
        onEvent: (e) => {
          if (e.type === "conversation") {
            setConversationId(e.conversation_id);
          } else if (e.type === "tool_call_start") {
            setMessages((prev) => [
              ...prev,
              { role: "tool", toolId: e.id, name: e.name, args: e.args, pending: true },
            ]);
          } else if (e.type === "tool_call_result") {
            setMessages((prev) =>
              prev.map((m) =>
                m.role === "tool" && m.toolId === e.id ? { ...m, result: e.result, pending: false } : m,
              ),
            );
            if (e.name === "create_itinerary_item" && (e.result as { ok?: boolean })?.ok) {
              const item = (e.result as { item?: { title?: string } }).item;
              toast({ title: "Added to itinerary", description: item?.title || "" });
              if (activeTrip) fetchItineraryItems(activeTrip.id);
            }
          } else if (e.type === "delta") {
            upsertAssistant(e.content);
          } else if (e.type === "error") {
            if (e.status === 429) toast({ title: "Concierge is warming up", description: "Try again in a moment." });
            else if (e.status === 402) toast({ title: "AI credits exhausted", description: "Add funds in Settings → Workspace → Usage.", variant: "destructive" });
            else toast({ title: "Concierge unavailable", description: e.error });
          }
        },
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setConversationId(null);
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
      cost: suggestion.estimated_cost ?? null,
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
      cost: suggestion.estimated_cost ?? null,
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
      <footer className="sticky bottom-0 z-30 hidden h-12 items-center justify-between border-t border-border bg-background/95 px-6 backdrop-blur-sm sm:flex">
        <p className="font-inter text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
          © {new Date().getFullYear()} TML Network
        </p>

        <button
          type="button"
          onClick={() => { setHasOpened(true); setOpen((o) => !o); }}
          aria-expanded={open}
          aria-label={open ? "Close Gemini Concierge" : "Open Gemini Concierge"}
          className={cn(
            "group relative inline-flex items-center gap-2.5 rounded-editorial border border-foil px-3.5 py-1.5 min-h-[36px] overflow-hidden",
            "transition-all duration-quick ease-magnetic hover:-translate-y-px hover:shadow-foil",
            open
              ? "bg-surface-3 text-muted-foreground"
              : "bg-foil text-accent-foreground shadow-paper",
          )}
        >
          {/* Foil sweep — visible on hover when closed */}
          {!open && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-[1100ms] ease-editorial group-hover:translate-x-full"
            />
          )}

          {open ? (
            <>
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="font-inter text-[10px] uppercase tracking-[0.22em]">Close</span>
            </>
          ) : (
            <>
              {/* AI orb */}
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-white/25 blur-[3px] animate-pulse" />
                <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-white/70 via-white/20 to-transparent" />
                <Sparkles className="relative h-2.5 w-2.5 text-accent-foreground" strokeWidth={2} />
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="font-playfair text-[13px] italic tracking-wide">Concierge</span>
                <span className="font-inter text-[8px] uppercase tracking-[0.28em] text-accent-foreground/75 -mt-px">
                  Ask Gemini
                </span>
              </span>
            </>
          )}
        </button>
      </footer>

      {/* Chat Panel */}
      {hasOpened && (
      <div
        className={cn(
          "fixed z-50 flex flex-col rounded-hero border border-foil bg-card shadow-foil overflow-hidden",
          "transition-all duration-soft ease-editorial origin-bottom-right",
          "bottom-16 right-6 w-[400px] h-[580px] max-h-[calc(100vh-6rem)]",
          "max-sm:left-2 max-sm:right-2 max-sm:bottom-[calc(env(safe-area-inset-bottom)+72px)] max-sm:w-auto max-sm:h-[68vh]",
          open
            ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
            : "translate-y-1 scale-95 opacity-0 pointer-events-none",
        )}
      >
        {/* Grain / paper overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-vignette)" }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-foil px-4 py-3 bg-foil-soft/40">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Orb */}
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foil shadow-foil">
              <span className="absolute inset-0 rounded-full bg-white/20 blur-[2px]" />
              <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-white/60 via-white/10 to-transparent" />
              <Sparkles className="relative h-3 w-3 text-accent-foreground" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="font-playfair text-[14px] font-semibold leading-none text-foreground">
                Gemini Concierge
              </p>
              <p className="mt-1 font-inter text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                AI Travel Advisor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="rounded-editorial p-1.5 text-muted-foreground transition-colors hover:bg-foil-soft hover:text-foreground"
                title="New conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded-editorial p-1.5 text-muted-foreground transition-colors hover:bg-foil-soft hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="font-inter text-[9px] uppercase tracking-[0.28em] text-accent">
                  {activeTrip ? "Grounded · in this trip" : "Open invitation"}
                </p>
                <p className="font-playfair text-[15px] italic leading-snug text-foreground">
                  {activeTrip
                    ? `What shall we refine for ${activeTrip.destination ?? "your trip"}?`
                    : "Where would you like to be taken?"}
                </p>
                <p className="font-inter text-[11px] leading-relaxed text-muted-foreground">
                  Recommendations, gap analysis, or points strategy — all on the table.
                </p>
              </div>
              <div className="space-y-1.5">
                {quickPrompts.map((q, i) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="animate-stagger-in block w-full rounded-editorial border border-foil bg-foil-soft/40 px-3 py-2 text-left font-inter text-[11px] text-foreground transition-all duration-quick ease-editorial hover:-translate-y-px hover:border-foil-strong hover:bg-foil-soft hover:shadow-paper"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <Sparkles className="mr-1.5 inline h-2.5 w-2.5 text-accent" strokeWidth={1.75} />
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
                    <div className="max-w-[85%] rounded-editorial px-3 py-2 bg-foil text-accent-foreground font-inter text-[11px] leading-relaxed shadow-paper">
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              }

              if (m.role === "tool") {
                const ok = !m.pending && !(m.result as { error?: string })?.error;
                const label = m.name.replace(/_/g, " ");
                return (
                  <div key={i} className="flex justify-start">
                    <div className="inline-flex items-center gap-1.5 rounded-editorial border border-foil bg-foil-soft/40 px-2.5 py-1 font-inter text-[10px] text-muted-foreground">
                      {m.pending ? (
                        <Loader2 className="h-3 w-3 animate-spin text-accent" strokeWidth={1.75} />
                      ) : ok ? (
                        <CheckCircle2 className="h-3 w-3 text-accent" strokeWidth={1.75} />
                      ) : (
                        <Wrench className="h-3 w-3 text-destructive" strokeWidth={1.75} />
                      )}
                      <span className="uppercase tracking-wider">
                        {m.pending ? `Calling ${label}…` : label}
                      </span>
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
                        <Suspense fallback={<span className="text-muted-foreground">…</span>}>
                          <ReactMarkdown>{displayText || "…"}</ReactMarkdown>
                        </Suspense>
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
              <div className="flex items-center gap-1 rounded-editorial border border-foil bg-foil-soft/50 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent/80 animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-pulse" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-foil px-3 py-3 bg-background/60">
          <AnimatedAIChat
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            sending={streaming}
            placeholder="Ask the concierge…"
          />
        </div>
      </div>
      )}
    </>
  );
}
