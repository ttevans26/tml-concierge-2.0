import { useMemo, useState, useCallback } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTripStore } from "@/stores/useTripStore";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import ItineraryItemCard from "./ItineraryItemCard";
import AddItemDialog from "./AddItemDialog";
import TripSettingsModal from "./TripSettingsModal";
import SmartPullTray, { type ExtractedItem } from "./SmartPullTray";
import type { ItineraryItem } from "@/stores/useTripStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import type { StudioItem } from "@/stores/useStudioStore";
import ShareControls from "./ShareControls";
import { Button } from "@/components/ui/button";
import CalendarStaysView from "./CalendarStaysView";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** Check if two time ranges overlap. Items without times don't conflict. */
function timesOverlap(a: ItineraryItem, b: ItineraryItem): boolean {
  if (!a.start_time || !b.start_time) return false;
  const aEnd = a.end_time || a.start_time;
  const bEnd = b.end_time || b.start_time;
  return a.start_time < bEnd && b.start_time < aEnd;
}

/** Returns a Set of item IDs that have time conflicts in the same cell. */
function detectConflicts(items: ItineraryItem[]): Set<string> {
  const ids = new Set<string>();
  const cells = new Map<string, ItineraryItem[]>();
  for (const item of items) {
    const key = `${item.date}|${item.category}`;
    const arr = cells.get(key) || [];
    arr.push(item);
    cells.set(key, arr);
  }
  for (const group of cells.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (timesOverlap(group[i], group[j])) {
          ids.add(group[i].id);
          ids.add(group[j].id);
        }
      }
    }
  }
  return ids;
}

const CATEGORIES = [
  { key: "stays" as const, label: "Stays" },
  { key: "logistics" as const, label: "Logistics" },
  { key: "dining" as const, label: "Dining" },
  { key: "activity" as const, label: "Activity" },
];

const CELL_BG: Record<string, string> = {
  stays: "bg-[hsl(var(--cell-stays))]",
  logistics: "bg-[hsl(var(--cell-logistics))]",
  dining: "bg-[hsl(var(--cell-dining))]",
  activity: "bg-[hsl(var(--cell-activity))]",
};

export default function MatrixGrid() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    date: string;
    category: ItineraryItem["category"];
  }>({ open: false, date: "", category: "activity" });

  // Smart Pull state
  const [smartPullOpen, setSmartPullOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [pendingItems, setPendingItems] = useState<ExtractedItem[]>([]);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());

  // View mode: matrix grid vs. calendar month view (persisted)
  const [viewMode, setViewMode] = useState<"matrix" | "calendar">(() => {
    if (typeof window === "undefined") return "matrix";
    const saved = window.localStorage.getItem("tml-view-mode");
    return saved === "calendar" ? "calendar" : "matrix";
  });
  const changeViewMode = (m: "matrix" | "calendar") => {
    setViewMode(m);
    try {
      window.localStorage.setItem("tml-view-mode", m);
    } catch {
      /* ignore */
    }
  };

  const days = useMemo(() => {
    if (!activeTrip?.start_date || !activeTrip?.end_date) return [];
    try {
      return eachDayOfInterval({
        start: parseISO(activeTrip.start_date),
        end: parseISO(activeTrip.end_date),
      });
    } catch {
      return [];
    }
  }, [activeTrip?.start_date, activeTrip?.end_date]);

  const conflictIds = useMemo(() => detectConflicts(itineraryItems), [itineraryItems]);

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      totals[dateStr] = itineraryItems
        .filter((i) => i.date === dateStr && i.cost != null)
        .reduce((sum, i) => sum + Number(i.cost), 0);
    }
    return totals;
  }, [days, itineraryItems]);

  /* ---- Smart Pull handlers ---- */

  const handleExtract = useCallback(async () => {
    if (!emailText.trim()) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-pull", {
        body: { email_text: emailText.trim() },
      });

      if (error) {
        toast.error(error.message || "Smart Pull failed");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const items: ExtractedItem[] = (data?.items || []).map(
        (item: any, idx: number) => ({
          ...item,
          id: `sp-${Date.now()}-${idx}`,
        })
      );

      if (items.length === 0) {
        toast.info("No travel items found in this text.");
        return;
      }

      setPendingItems((prev) => [...prev, ...items]);
      setSmartPullOpen(false);
      setEmailText("");
      toast.success(`Extracted ${items.length} item${items.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e?.message || "Smart Pull failed");
    } finally {
      setExtracting(false);
    }
  }, [emailText]);

  const handleAccept = useCallback(
    async (item: ExtractedItem) => {
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
            flight_number: item.flight_number || null,
            departure_airport: item.departure_airport || null,
            arrival_airport: item.arrival_airport || null,
          },
        });

        setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
        toast.success(`Added "${item.title}" to itinerary`);

        // Background Aviationstack enrichment for flights
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
                toast.info(`Gate/terminal info added for ${item.flight_number}`);
              }
            })
            .catch(() => {
              toast.info("Gate info unavailable — flight data preserved.");
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
    [activeTrip, createItineraryItem, updateItineraryItem]
  );

  const handleDismiss = useCallback((itemId: string) => {
    setPendingItems((prev) => prev.filter((p) => p.id !== itemId));
  }, []);

  /* ---- Drag-and-drop from Studio sidebar ---- */

  const handleDrop = useCallback(
    async (e: React.DragEvent, dateStr: string, category: ItineraryItem["category"]) => {
      const raw = e.dataTransfer.getData("application/studio-item");
      if (!raw || !activeTrip) return;
      e.preventDefault();

      try {
        const studioItem: StudioItem = JSON.parse(raw);

        // Map studio category to itinerary category
        let mappedCategory: ItineraryItem["category"] = category;
        if (studioItem.category === "stays") mappedCategory = "stays";
        else if (studioItem.category === "dining") mappedCategory = "dining";
        else if (studioItem.category === "activity") mappedCategory = "activity";
        else if (studioItem.category === "sites") mappedCategory = "sites_of_interest";

        await createItineraryItem({
          trip_id: activeTrip.id,
          category: mappedCategory,
          title: studioItem.title,
          description: studioItem.description || null,
          date: dateStr,
          cost: studioItem.cost ?? null,
          location_name: studioItem.address || null,
          location_lat: studioItem.lat ?? null,
          location_lng: studioItem.lng ?? null,
          google_place_id: studioItem.google_place_id || null,
          source_url: studioItem.source_url || null,
          approval_status: "draft",
          api_metadata: {
            studio_source: true,
            studio_item_id: studioItem.id,
            studio_folder_id: studioItem.folder_id,
            ...(studioItem.api_metadata || {}),
          },
        });

        toast.success(`"${studioItem.title}" added to ${format(parseISO(dateStr), "MMM d")}`);
      } catch {
        toast.error("Failed to drop item");
      }
    },
    [activeTrip, createItineraryItem]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/studio-item")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  if (days.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background px-8 text-center">
        <h3 className="font-playfair text-lg font-semibold text-foreground">
          No dates set
        </h3>
        <p className="mt-2 max-w-xs font-inter text-xs text-muted-foreground leading-relaxed">
          Add start and end dates to your trip to see the planning timeline.
        </p>
      </div>
    );
  }

  const openAdd = (date: string, category: ItineraryItem["category"]) =>
    setDialogState({ open: true, date, category });

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Grid header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-playfair text-sm font-semibold text-foreground">
            {viewMode === "matrix" ? "Matrix Grid" : "Calendar"}
          </h2>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="hidden sm:flex items-center rounded-sm border border-border overflow-hidden">
              <button
                onClick={() => changeViewMode("matrix")}
                className={`px-2.5 py-1 font-inter text-[11px] min-h-[32px] touch-manipulation transition-colors ${
                  viewMode === "matrix"
                    ? "bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Matrix
              </button>
              <button
                onClick={() => changeViewMode("calendar")}
                className={`px-2.5 py-1 font-inter text-[11px] min-h-[32px] border-l border-border touch-manipulation transition-colors ${
                  viewMode === "calendar"
                    ? "bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Calendar
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-1.5 touch-manipulation"
              onClick={() => setSmartPullOpen(true)}
            >
              <Mail className="h-4 w-4" />
              <span className="font-inter text-xs">Smart Pull</span>
            </Button>
            <ShareControls />
            <TripSettingsModal />
          </div>
        </div>
        {/* Mobile view-mode toggle */}
        <div className="mt-2 flex sm:hidden items-center rounded-sm border border-border overflow-hidden w-fit">
          <button
            onClick={() => changeViewMode("matrix")}
            className={`px-3 py-1 font-inter text-[11px] min-h-[36px] touch-manipulation transition-colors ${
              viewMode === "matrix"
                ? "bg-accent text-accent-foreground"
                : "bg-background text-muted-foreground"
            }`}
          >
            Matrix
          </button>
          <button
            onClick={() => changeViewMode("calendar")}
            className={`px-3 py-1 font-inter text-[11px] min-h-[36px] border-l border-border touch-manipulation transition-colors ${
              viewMode === "calendar"
                ? "bg-accent text-accent-foreground"
                : "bg-background text-muted-foreground"
            }`}
          >
            Calendar
          </button>
        </div>
        <p className="mt-0.5 font-inter text-[11px] text-muted-foreground">
          {days.length} day{days.length !== 1 ? "s" : ""} · {format(days[0], "MMM d")} — {format(days[days.length - 1], "MMM d, yyyy")}
        </p>
      </div>

      {/* Smart Pull review tray */}
      <SmartPullTray
        items={pendingItems}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
        acceptingIds={acceptingIds}
      />

      {/* Scrollable matrix */}
      {viewMode === "calendar" ? (
        <CalendarStaysView />
      ) : (
      <ScrollArea className="flex-1">
        <div className="flex min-w-max">
          {/* Category labels column — sticky left */}
          <div className="sticky left-0 z-20 w-24 shrink-0 border-r border-border bg-card">
            <div className="sticky top-0 z-30 h-10 border-b border-border bg-card" />
            {CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="flex h-28 items-center border-b border-border px-3"
              >
                <span className="font-inter text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  {cat.label}
                </span>
              </div>
            ))}
            <div className="flex h-8 items-center border-b border-border px-3">
              <span className="font-inter text-[10px] font-semibold uppercase tracking-widest text-accent">
                Daily $
              </span>
            </div>
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const total = dailyTotals[dateStr] || 0;
            return (
              <div key={dateStr} className="w-44 shrink-0 border-r border-border last:border-r-0">
                <div className="sticky top-0 z-10 flex h-10 items-center justify-center border-b border-border bg-secondary/40 backdrop-blur-sm">
                  <span className="font-inter text-[11px] font-medium text-foreground">
                    {format(day, "EEE, MMM d")}
                  </span>
                </div>

                {CATEGORIES.map((cat) => {
                  const cellItems = itineraryItems.filter(
                    (item) => item.date === dateStr && item.category === cat.key
                  );
                  const isStay = cat.key === "stays";
                  const stayOccupied = isStay && cellItems.length > 0;

                  return (
                    <div
                      key={cat.key}
                      className={`flex h-28 flex-col gap-1 border-b border-border p-1.5 overflow-y-auto ${CELL_BG[cat.key]}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dateStr, cat.key)}
                    >
                      {cellItems.map((item) => (
                        <ItineraryItemCard key={item.id} item={item} hasConflict={conflictIds.has(item.id)} />
                      ))}
                      {!stayOccupied && (
                        <button
                          onClick={() => openAdd(dateStr, cat.key)}
                          className="flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border/60 py-1 min-h-[44px] transition-colors hover:border-accent/50 hover:bg-accent/5 touch-manipulation"
                        >
                          <span className="font-inter text-[10px] text-muted-foreground/60 hover:text-accent">
                            + Add
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="flex h-8 items-center justify-center border-b border-border bg-secondary/20">
                  <span className="font-inter text-[10px] font-semibold text-foreground">
                    {total > 0 ? `$${total.toLocaleString()}` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {activeTrip && (
        <AddItemDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState((s) => ({ ...s, open }))}
          tripId={activeTrip.id}
          date={dialogState.date}
          category={dialogState.category}
        />
      )}

      {/* Smart Pull paste dialog */}
      <Dialog open={smartPullOpen} onOpenChange={setSmartPullOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-playfair">Smart Pull</DialogTitle>
            <DialogDescription className="font-inter text-xs">
              Paste a booking confirmation email and AI will extract the travel details.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Paste your confirmation email text here…"
            className="min-h-[160px] font-inter text-xs"
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            disabled={extracting}
          />
          <DialogFooter>
            <Button
              onClick={handleExtract}
              disabled={extracting || emailText.trim().length < 10}
              className="min-h-[44px] touch-manipulation"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing confirmation…
                </>
              ) : (
                "Extract"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
