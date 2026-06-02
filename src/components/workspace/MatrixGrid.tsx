import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useTripStore } from "@/stores/useTripStore";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import ItineraryItemCard from "./ItineraryItemCard";
import AddItemDialog from "./AddItemDialog";
import TripSettingsModal from "./TripSettingsModal";
import SmartPullInbox from "./SmartPullInbox";
import type { ItineraryItem } from "@/stores/useTripStore";
import { toast } from "sonner";
import { Inbox, Lock, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import type { StudioItem } from "@/stores/useStudioStore";
import ShareControls from "./ShareControls";
import { Button } from "@/components/ui/button";
import CalendarStaysView from "./CalendarStaysView";

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
  const updateTrip = useTripStore((s) => s.updateTrip);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ active: boolean; startX: number; startLeft: number; moved: boolean }>({
    active: false,
    startX: 0,
    startLeft: 0,
    moved: false,
  });
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  const COL_WIDTH = 176; // matches w-44

  const scrollByCols = (cols: number) => {
    scrollRef.current?.scrollBy({ left: cols * COL_WIDTH, behavior: "smooth" });
  };
  const scrollToStart = () => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  const isInteractive = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest(
      'button, a, input, textarea, select, [draggable="true"], [role="button"], [data-no-pan]'
    );
  };

  const onPanMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isInteractive(e.target)) return;
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = {
      active: true,
      startX: e.clientX,
      startLeft: el.scrollLeft,
      moved: false,
    };
  };
  const onPanMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 3) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startLeft - dx;
  };
  const endPan = () => {
    dragState.current.active = false;
    setTimeout(() => {
      dragState.current.moved = false;
    }, 0);
  };

  /**
   * Smooth wheel → horizontal pan.
   * Vertical wheel deltas are accumulated and eased toward a target scrollLeft
   * inside a requestAnimationFrame loop so trackpad/mouse wheel feels fluid
   * while the page continues to scroll vertically as normal.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let targetLeft = el.scrollLeft;
    let rafId: number | null = null;
    let lastTs = 0;

    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(64, ts - lastTs);
      lastTs = ts;
      const current = el.scrollLeft;
      const diff = targetLeft - current;
      if (Math.abs(diff) < 0.5) {
        el.scrollLeft = targetLeft;
        rafId = null;
        lastTs = 0;
        return;
      }
      // Exponential ease: ~18% of remaining distance per 16ms frame.
      const ease = 1 - Math.pow(1 - 0.18, dt / 16);
      el.scrollLeft = current + diff * ease;
      rafId = requestAnimationFrame(tick);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const maxLeft = el.scrollWidth - el.clientWidth;
      // Snap target to current scroll if user reversed direction mid-animation.
      if (rafId === null) targetLeft = el.scrollLeft;
      const next = Math.max(0, Math.min(maxLeft, targetLeft + e.deltaY));

      // Only consume the wheel event if we can actually pan horizontally;
      // otherwise let the page scroll vertically uninterrupted.
      const canPan =
        (e.deltaY > 0 && targetLeft < maxLeft) || (e.deltaY < 0 && targetLeft > 0);
      if (!canPan) return;

      targetLeft = next;
      if (rafId === null) {
        lastTs = 0;
        rafId = requestAnimationFrame(tick);
      }
    };

    // passive: true — we don't preventDefault, page still scrolls vertically.
    el.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    date: string;
    category: ItineraryItem["category"];
  }>({ open: false, date: "", category: "activity" });

  // Smart Pull state
  const [smartPullOpen, setSmartPullOpen] = useState(false);

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

  // Smart Pull logic is encapsulated in <SmartPullInbox /> below.

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
              <Inbox className="h-4 w-4" />
              <span className="font-inter text-xs">Smart Pull</span>
            </Button>
            <ShareControls />
            <TripSettingsModal />
          </div>
        </div>
        {viewMode === "matrix" && (
          <div className="mt-2 hidden sm:flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => scrollByCols(-1)}
              disabled={atStart}
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 font-inter text-[11px]"
              onClick={scrollToStart}
              disabled={atStart}
              title="Jump to start"
            >
              Start
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => scrollByCols(1)}
              disabled={atEnd}
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 font-inter text-[10px] text-muted-foreground/70">
              Drag, scroll, or use arrows to pan
            </span>
          </div>
        )}
        {activeTrip && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateTrip(activeTrip.id, { is_published: !activeTrip.is_published })}
              title={
                activeTrip.is_published
                  ? "Public — visible to your network"
                  : "Private — hidden even from your connections"
              }
              className={`inline-flex items-center gap-1.5 rounded-sm border-thin px-2 py-1 min-h-[32px] font-inter text-[11px] transition-colors touch-manipulation ${
                activeTrip.is_published
                  ? "border-accent/40 text-accent bg-accent/5 hover:bg-accent/10"
                  : "border-foreground/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              {activeTrip.is_published ? (
                <Globe className="h-3 w-3" strokeWidth={1.5} />
              ) : (
                <Lock className="h-3 w-3" strokeWidth={1.5} />
              )}
              {activeTrip.is_published ? "Public Trip" : "Private Trip"}
            </button>
          </div>
        )}
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

      {/* Scrollable matrix */}
      {viewMode === "calendar" ? (
        <CalendarStaysView />
      ) : (
      <div
        ref={scrollRef}
        onMouseDown={onPanMouseDown}
        onMouseMove={onPanMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        className={`flex-1 overflow-auto select-none ${
          dragState.current.active ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
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
      </div>
      )}

      {activeTrip && (
        <AddItemDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState((s) => ({ ...s, open }))}
          tripId={activeTrip.id}
          date={dialogState.date}
          category={dialogState.category}
        />
      )}

      {/* Smart Pull Inbox: paste · review · history · diff · batch */}
      <SmartPullInbox open={smartPullOpen} onOpenChange={setSmartPullOpen} />
    </div>
  );
}
