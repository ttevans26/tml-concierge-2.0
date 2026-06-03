import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Check,
  X,
  Loader2,
  Inbox,
  Hotel,
  Plane,
  UtensilsCrossed,
  MapPin,
  AlertTriangle,
  Sparkles,
  CopyCheck,
  Trash2,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTripStore } from "@/stores/useTripStore";
import { useGmailConnectionStatus } from "@/hooks/useGmailConnectionStatus";
import type { ItineraryItem } from "@/stores/useTripStore";
import type { ExtractedItem } from "./SmartPullTray";
import { diffItem, splitBatch, type DiffResult } from "@/lib/smartPullDiff";
import { format } from "date-fns";

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  stays: <Hotel className="h-3.5 w-3.5" />,
  logistics: <Plane className="h-3.5 w-3.5" />,
  dining: <UtensilsCrossed className="h-3.5 w-3.5" />,
  activity: <MapPin className="h-3.5 w-3.5" />,
};

interface PendingItem extends ExtractedItem {
  eventId: string;
}

interface PullEvent {
  id: string;
  trip_id: string;
  source_preview: string;
  chunk_count: number;
  extracted_count: number;
  applied_ids: string[]; // ExtractedItem.id values that were accepted
  dismissed_ids: string[];
  created_at: number;
}

const HISTORY_KEY = (tripId: string) => `tml-smart-pull-history:${tripId}`;
const PENDING_KEY = (tripId: string) => `tml-smart-pull-pending:${tripId}`;
const MAX_HISTORY = 25;

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

interface SmartPullInboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SmartPullInbox({ open, onOpenChange }: SmartPullInboxProps) {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);

  const tripId = activeTrip?.id || "";

  const [tab, setTab] = useState<"paste" | "review" | "history">("paste");
  const [emailText, setEmailText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [history, setHistory] = useState<PullEvent[]>([]);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const gmailStatus = useGmailConnectionStatus(open);

  // Load persisted state when trip changes
  useEffect(() => {
    if (!tripId) return;
    setPending(loadJSON<PendingItem[]>(PENDING_KEY(tripId), []));
    setHistory(loadJSON<PullEvent[]>(HISTORY_KEY(tripId), []));
  }, [tripId]);

  // Persist
  useEffect(() => {
    if (tripId) saveJSON(PENDING_KEY(tripId), pending);
  }, [tripId, pending]);
  useEffect(() => {
    if (tripId) saveJSON(HISTORY_KEY(tripId), history);
  }, [tripId, history]);

  // Diff every pending item against current itinerary
  const diffs = useMemo(() => {
    const map = new Map<string, DiffResult>();
    for (const p of pending) map.set(p.id, diffItem(p, itineraryItems));
    return map;
  }, [pending, itineraryItems]);

  const newCount = useMemo(
    () => pending.filter((p) => diffs.get(p.id)?.status === "new").length,
    [pending, diffs],
  );

  /* ---- Extract (with batching) ---- */

  const handleExtract = useCallback(async () => {
    if (!emailText.trim() || !tripId) return;
    const chunks = splitBatch(emailText);
    if (chunks.length === 0) {
      toast.error("Paste at least one confirmation (10+ chars).");
      return;
    }
    setExtracting(true);
    const eventId = `evt-${Date.now()}`;
    try {
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase.functions
            .invoke("smart-pull", { body: { email_text: chunk } })
            .then(({ data, error }) => {
              if (error || data?.error) {
                throw new Error(error?.message || data?.error || "Extraction failed");
              }
              return (data?.items || []) as Omit<ExtractedItem, "id">[];
            }),
        ),
      );
      const flat = results.flat();
      if (flat.length === 0) {
        toast.info("No travel items found.");
        return;
      }
      const newPending: PendingItem[] = flat.map((item, idx) => ({
        ...item,
        id: `${eventId}-${idx}`,
        eventId,
      }));
      setPending((prev) => [...prev, ...newPending]);

      const event: PullEvent = {
        id: eventId,
        trip_id: tripId,
        source_preview: emailText.trim().slice(0, 120),
        chunk_count: chunks.length,
        extracted_count: flat.length,
        applied_ids: [],
        dismissed_ids: [],
        created_at: Date.now(),
      };
      setHistory((prev) => [event, ...prev].slice(0, MAX_HISTORY));
      setEmailText("");
      setTab("review");
      toast.success(
        `Extracted ${flat.length} item${flat.length !== 1 ? "s" : ""} from ${chunks.length} email${chunks.length !== 1 ? "s" : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smart Pull failed");
    } finally {
      setExtracting(false);
    }
  }, [emailText, tripId]);

  /* ---- Accept / dismiss ---- */

  const persistEventOutcome = useCallback(
    (eventId: string, itemId: string, kind: "applied" | "dismissed") => {
      setHistory((prev) =>
        prev.map((ev) =>
          ev.id !== eventId
            ? ev
            : {
                ...ev,
                applied_ids:
                  kind === "applied" ? [...ev.applied_ids, itemId] : ev.applied_ids,
                dismissed_ids:
                  kind === "dismissed" ? [...ev.dismissed_ids, itemId] : ev.dismissed_ids,
              },
        ),
      );
    },
    [],
  );

  const acceptOne = useCallback(
    async (item: PendingItem) => {
      if (!activeTrip) return;
      setAcceptingIds((prev) => new Set(prev).add(item.id));
      try {
        const newItem = await createItineraryItem({
          trip_id: activeTrip.id,
          category: item.category,
          title: item.title,
          description: item.description || null,
          date: item.date || null,
          start_time: item.start_time || null,
          end_time: item.end_time || null,
          cost: item.estimated_cost ?? null,
          currency: item.currency || "USD",
          confirmation_code: item.confirmation_code || null,
          location_name: item.location_name || null,
          approval_status: "draft",
          api_metadata: {
            smart_pull: true,
            smart_pull_event: item.eventId,
            flight_number: item.flight_number || null,
            departure_airport: item.departure_airport || null,
            arrival_airport: item.arrival_airport || null,
          },
        });

        setPending((prev) => prev.filter((p) => p.id !== item.id));
        persistEventOutcome(item.eventId, item.id, "applied");
        toast.success(`Added "${item.title}"`);

        if (newItem && item.flight_number) {
          supabase.functions
            .invoke("aviationstack-lookup", {
              body: { flight_iata: item.flight_number },
            })
            .then(({ data: flightData }) => {
              if (flightData?.gate || flightData?.terminal) {
                updateItineraryItem(newItem.id, {
                  api_metadata: {
                    ...((newItem.api_metadata as Record<string, unknown>) || {}),
                    gate: flightData.gate,
                    terminal: flightData.terminal,
                    flight_status: flightData.status,
                  },
                });
              }
            })
            .catch(() => {
              /* silent */
            });
        }
      } catch {
        toast.error("Failed to add item");
      } finally {
        setAcceptingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [activeTrip, createItineraryItem, updateItineraryItem, persistEventOutcome],
  );

  const dismissOne = useCallback(
    (item: PendingItem) => {
      setPending((prev) => prev.filter((p) => p.id !== item.id));
      persistEventOutcome(item.eventId, item.id, "dismissed");
    },
    [persistEventOutcome],
  );

  const acceptAllNew = useCallback(async () => {
    const toAccept = pending.filter((p) => diffs.get(p.id)?.status === "new");
    for (const item of toAccept) {
      // sequential to avoid race in store + clearer toasts
      // eslint-disable-next-line no-await-in-loop
      await acceptOne(item);
    }
  }, [pending, diffs, acceptOne]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  /* ---- Sync from Gmail ---- */
  const handleSyncGmail = useCallback(async () => {
    if (!tripId) return;
    setSyncingGmail(true);
    const eventId = `gmail-${Date.now()}`;
    try {
      const { data, error } = await supabase.functions.invoke("smart-pull-gmail", {
        body: { maxResults: 10 },
      });
      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Gmail sync failed");
      }
      const items = (data?.items || []) as Omit<ExtractedItem, "id">[];
      const scanned = Number(data?.scanned ?? 0);
      if (items.length === 0) {
        toast.info(`Scanned ${scanned} Gmail message${scanned !== 1 ? "s" : ""}, no travel items found.`);
        return;
      }
      const newPending: PendingItem[] = items.map((item, idx) => ({
        ...item,
        id: `${eventId}-${idx}`,
        eventId,
      }));
      setPending((prev) => [...prev, ...newPending]);
      const event: PullEvent = {
        id: eventId,
        trip_id: tripId,
        source_preview: `Gmail · ${scanned} message${scanned !== 1 ? "s" : ""} scanned`,
        chunk_count: scanned,
        extracted_count: items.length,
        applied_ids: [],
        dismissed_ids: [],
        created_at: Date.now(),
      };
      setHistory((prev) => [event, ...prev].slice(0, MAX_HISTORY));
      setTab("review");
      toast.success(`Pulled ${items.length} item${items.length !== 1 ? "s" : ""} from Gmail`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gmail sync failed");
    } finally {
      setSyncingGmail(false);
    }
  }, [tripId]);

  /* ---- Render ---- */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-playfair flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Smart Pull Inbox
          </DialogTitle>
          <DialogDescription className="font-inter text-xs">
            Paste confirmations (separate multiple with <code className="rounded bg-muted px-1">---</code>),
            review parsed items against your itinerary, and accept what fits.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="paste">Paste</TabsTrigger>
            <TabsTrigger value="review">
              Review {pending.length > 0 && <Badge variant="secondary" className="ml-2">{pending.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* PASTE */}
          <TabsContent value="paste" className="flex-1 flex flex-col gap-3 mt-3 min-h-0">
            <div className="flex items-center justify-between gap-2 rounded-[2px] border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-3.5 w-3.5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="font-inter text-[11px] font-medium text-foreground flex items-center gap-1.5">
                    Sync from Gmail
                    <span
                      className={
                        "inline-block h-1.5 w-1.5 rounded-full " +
                        (gmailStatus.state === "connected"
                          ? "bg-emerald-500"
                          : gmailStatus.state === "loading"
                            ? "bg-muted-foreground animate-pulse"
                            : "bg-amber-500")
                      }
                      title={
                        gmailStatus.state === "connected"
                          ? "Gmail connected"
                          : gmailStatus.state === "loading"
                            ? "Checking connection…"
                            : (gmailStatus.reason || "Not connected")
                      }
                    />
                    <span className="font-inter text-[10px] font-normal text-muted-foreground">
                      {gmailStatus.state === "connected"
                        ? "Connected"
                        : gmailStatus.state === "loading"
                          ? "Checking…"
                          : "Not connected"}
                    </span>
                  </p>
                  <p className="font-inter text-[10px] text-muted-foreground truncate">
                    {gmailStatus.state === "disconnected"
                      ? (gmailStatus.reason || "Connect a Gmail account in Settings → Connectors.")
                      : "Scans the connected inbox for recent travel confirmations."}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={syncingGmail || extracting || gmailStatus.state !== "connected"}
                onClick={handleSyncGmail}
                className="min-h-[36px] shrink-0"
                title={gmailStatus.state !== "connected" ? "Connect Gmail first" : "Sync inbox"}
              >
                {syncingGmail ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Scanning…
                  </>
                ) : (
                  <>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Sync Gmail
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder={"Paste one or more confirmation emails.\nSeparate multiple with a line containing only ---"}
              className="min-h-[220px] flex-1 font-inter text-xs"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              disabled={extracting}
            />
            <div className="flex items-center justify-between">
              <span className="font-inter text-[11px] text-muted-foreground">
                {emailText.trim() ? `${splitBatch(emailText).length} email${splitBatch(emailText).length !== 1 ? "s" : ""} detected` : "Empty"}
              </span>
              <Button
                onClick={handleExtract}
                disabled={extracting || emailText.trim().length < 10}
                className="min-h-[44px] touch-manipulation"
              >
                {extracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Parse
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* REVIEW */}
          <TabsContent value="review" className="flex-1 flex flex-col mt-3 min-h-0">
            {pending.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center py-12">
                <p className="font-inter text-xs text-muted-foreground">
                  No items pending review. Paste a confirmation to get started.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                  <span className="font-inter text-[11px] text-muted-foreground">
                    {newCount} new · {pending.length - newCount} duplicate or conflict
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    className="min-h-[36px]"
                    onClick={acceptAllNew}
                    disabled={newCount === 0 || acceptingIds.size > 0}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept all new ({newCount})
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-2">
                    {pending.map((item) => {
                      const d = diffs.get(item.id);
                      return (
                        <ReviewRow
                          key={item.id}
                          item={item}
                          diff={d}
                          accepting={acceptingIds.has(item.id)}
                          onAccept={() => acceptOne(item)}
                          onDismiss={() => dismissOne(item)}
                        />
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="flex-1 flex flex-col mt-3 min-h-0">
            {history.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <p className="font-inter text-xs text-muted-foreground">No past Smart Pulls yet.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                  <span className="font-inter text-[11px] text-muted-foreground">
                    {history.length} past pull{history.length !== 1 ? "s" : ""}
                  </span>
                  <Button size="sm" variant="ghost" onClick={clearHistory} className="min-h-[32px] text-xs">
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-2">
                    {history.map((ev) => (
                      <div key={ev.id} className="rounded-sm border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-inter text-[11px] font-medium text-foreground">
                            {format(ev.created_at, "MMM d, h:mm a")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px]">
                              {ev.chunk_count} email{ev.chunk_count !== 1 ? "s" : ""}
                            </Badge>
                            <Badge variant="outline" className="text-[9px]">
                              {ev.extracted_count} extracted
                            </Badge>
                            <Badge variant="secondary" className="text-[9px]">
                              <CopyCheck className="h-2.5 w-2.5 mr-0.5" />
                              {ev.applied_ids.length} applied
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-1.5 font-inter text-[11px] text-muted-foreground line-clamp-2">
                          {ev.source_preview}…
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Single review row ---- */

interface ReviewRowProps {
  item: PendingItem;
  diff?: DiffResult;
  accepting: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

function ReviewRow({ item, diff, accepting, onAccept, onDismiss }: ReviewRowProps) {
  const status = diff?.status || "new";
  const statusStyles: Record<string, string> = {
    new: "border-accent/40 bg-accent/5",
    duplicate: "border-muted bg-muted/30 opacity-75",
    conflict: "border-destructive/40 bg-destructive/5",
  };
  const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    new: { label: "New", variant: "default" },
    duplicate: { label: "Already in trip", variant: "secondary" },
    conflict: { label: "Conflict", variant: "destructive" },
  };
  const sb = statusBadge[status];

  return (
    <div className={`rounded-sm border-2 p-3 ${statusStyles[status]}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {CATEGORY_ICON[item.category]}
            <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
              {item.category}
            </Badge>
            <Badge variant={sb.variant} className="text-[9px]">
              {status === "conflict" && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
              {sb.label}
            </Badge>
          </div>
          <p className="font-inter text-xs font-semibold text-foreground leading-tight">{item.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-inter text-[10px] text-muted-foreground">
            {item.date && (
              <span>
                {item.date}
                {item.start_time && ` · ${item.start_time}`}
                {item.end_time && `–${item.end_time}`}
              </span>
            )}
            {item.departure_airport && item.arrival_airport && (
              <span>
                {item.departure_airport} → {item.arrival_airport}
              </span>
            )}
            {item.estimated_cost != null && (
              <span className="font-medium text-foreground">
                {item.currency || "USD"} ${item.estimated_cost.toLocaleString()}
              </span>
            )}
            {item.confirmation_code && (
              <span className="font-mono">{item.confirmation_code}</span>
            )}
          </div>
          {diff?.reason && status !== "new" && (
            <p className="mt-1 font-inter text-[10px] italic text-muted-foreground">
              {diff.reason}
              {diff.match && ` — "${diff.match.title}"`}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button
            size="sm"
            variant={status === "duplicate" ? "outline" : "default"}
            className="min-h-[36px] text-xs"
            onClick={onAccept}
            disabled={accepting}
          >
            {accepting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                {status === "duplicate" ? "Add anyway" : "Accept"}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[36px] text-xs"
            onClick={onDismiss}
            disabled={accepting}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}