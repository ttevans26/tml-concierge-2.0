import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Plus, Pencil, MessagesSquare, Trash2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTripStore, type ItineraryItem } from "@/stores/useTripStore";
import { toast } from "@/hooks/use-toast";
import EditItemDialog from "@/components/workspace/EditItemDialog";
import ConciergeToolCard from "@/components/workspace/ConciergeToolCard";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type Msg = {
  id?: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown;
};

interface Conversation {
  id: string;
  title: string;
  trip_id: string | null;
  updated_at: string;
}

interface Suggestion {
  title: string;
  category: "stays" | "dining" | "activity" | "logistics";
  location_name?: string;
  description?: string;
  estimated_cost?: number;
  target: "studio" | "itinerary";
}

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
  const [sending, setSending] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<ItineraryItem | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  }, [messages, sending]);

  // Load conversations on mount / trip change
  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("concierge_conversations")
      .select("id, title, trip_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    setConversations((data || []) as Conversation[]);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, activeTrip?.id]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingThread(true);
      const { data } = await supabase
        .from("concierge_messages")
        .select("id, role, content, tool_calls")
        .eq("conversation_id", activeConvId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages(
          (data || [])
            .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "tool")
            // Hide assistant rows that only carry tool_calls with no visible content (rendered by tool cards instead)
            .filter((m) => !(m.role === "assistant" && !m.content && m.tool_calls))
            .map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant" | "tool",
              content: m.content,
              tool_calls: m.tool_calls,
            })),
        );
        setLoadingThread(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConvId]);

  // Cross-component prompt injection (e.g. from TripHealthBar "Ask concierge")
  useEffect(() => {
    if (pendingConciergePrompt && !sending) {
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
    "What's missing from this itinerary? Use get_trip_summary first.",
    activeAnchor ? `Dining near ${activeAnchor.title}` : "Standout dinner ideas",
    "Schedule a sunset cocktail bar near my anchor",
  ];

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("concierge-chat", {
        body: {
          conversation_id: activeConvId,
          trip_id: activeTrip?.id || null,
          message: trimmed,
          context: buildContext(),
        },
      });
      if (error || data?.error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 429)
          toast({ title: "Concierge is warming up", description: "Try again in a moment." });
        else if (status === 402)
          toast({ title: "AI credits exhausted", description: "Add funds in Settings → Workspace → Usage.", variant: "destructive" });
        else toast({ title: "Concierge unavailable", description: data?.error || "Please try again shortly." });
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      const newConvId = data.conversation_id as string;
      const content = (data.content as string) || "";
      const toolResults = (data.tool_results as { name: string; args?: Record<string, unknown>; result: any }[]) || [];
      if (newConvId !== activeConvId) setActiveConvId(newConvId);
      const toolMsgs: Msg[] = toolResults.map((tr) => ({
        role: "tool",
        content: JSON.stringify(tr.result ?? {}),
        tool_calls: { name: tr.name, args: tr.args },
      }));
      setMessages((prev) => [...prev, ...toolMsgs, { role: "assistant", content }]);
      // Toast on side-effect tools
      for (const tr of toolResults) {
        if (tr.name === "create_itinerary_item" && tr.result?.ok) {
          toast({ title: "Added to itinerary", description: tr.result.item?.title || "" });
          if (activeTrip) fetchItineraryItems(activeTrip.id);
        }
      }
      loadConversations();
    } catch (e) {
      console.error(e);
      toast({ title: "Concierge error", description: "Connection interrupted.", variant: "destructive" });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  function newConversation() {
    setActiveConvId(null);
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    await supabase.from("concierge_conversations").delete().eq("id", id);
    if (activeConvId === id) newConversation();
    loadConversations();
  }

  async function handleAddToItinerary(suggestion: Suggestion, msgIndex: number, openEditor = false) {
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
      if (openEditor) setEditItem(item);
    }
  }

  return (
    <div className="flex h-full bg-card">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-[160px] shrink-0 flex-col border-r border-border bg-background/40">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-2 py-2">
            <button
              onClick={newConversation}
              className="flex items-center gap-1 rounded-[2px] bg-accent px-2 py-1 font-inter text-[10px] uppercase tracking-wider text-accent-foreground hover:bg-accent/90"
              title="New conversation"
            >
              <Plus className="h-3 w-3" /> New
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Collapse"
            >
              <PanelLeftClose className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {conversations.length === 0 ? (
              <p className="px-2 py-2 font-inter text-[10px] text-muted-foreground">No threads yet.</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center justify-between gap-1 px-2 py-1.5 cursor-pointer border-l-2",
                    activeConvId === c.id
                      ? "border-accent bg-accent/5"
                      : "border-transparent hover:bg-muted/50",
                  )}
                  onClick={() => setActiveConvId(c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-inter text-[11px] text-foreground">{c.title}</p>
                    <p className="font-inter text-[9px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded-[2px] p-0.5 text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Thread pane */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Show conversations"
              >
                <PanelLeftOpen className="h-3 w-3" />
              </button>
            )}
            <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <p className="font-playfair text-[13px] font-semibold text-foreground">Concierge</p>
            {activeTrip && (
              <span className="font-inter text-[10px] text-muted-foreground truncate">
                · {activeTrip.destination || activeTrip.name}
              </span>
            )}
          </div>
        </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loadingThread ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-inter text-[11px]">Loading thread…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <p className="font-inter text-[11px] leading-relaxed text-muted-foreground">
              Grounded in this trip. Ask about gaps, recs, or points strategy. I can also schedule items directly.
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
            if (m.role === "tool") {
              const tc = (m.tool_calls as { name?: string; args?: Record<string, unknown> } | null) || {};
              let result: unknown = m.content;
              try { result = JSON.parse(m.content); } catch { /* keep raw */ }
              return (
                <div key={i} className="pl-2">
                  <ConciergeToolCard tc={{ name: tc.name || "tool", args: tc.args, result }} />
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
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isAdding || !activeTrip}
                              onClick={() => handleAddToItinerary(s, i, false)}
                              className="h-6 flex-1 gap-1 rounded-[2px] font-inter text-[10px]"
                            >
                              {isAdding ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isAdding || !activeTrip}
                              onClick={() => handleAddToItinerary(s, i, true)}
                              className="h-6 flex-1 gap-1 rounded-[2px] font-inter text-[10px]"
                              title="Add and open editor"
                            >
                              <Pencil className="h-3 w-3" />
                              Add & edit
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
        {sending && (
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
          disabled={sending}
          className="flex-1 rounded-[2px] border border-border bg-background px-2 py-1.5 font-inter text-[11px] text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !input.trim()}
          className="h-7 w-7 rounded-[2px] bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Send className="h-3 w-3" />
        </Button>
      </form>
      </div>
      {editItem && (
        <EditItemDialog
          open={!!editItem}
          onOpenChange={(o) => !o && setEditItem(null)}
          item={editItem}
        />
      )}
    </div>
  );
}