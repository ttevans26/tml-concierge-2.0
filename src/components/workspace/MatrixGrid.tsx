import { lazy, Suspense, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useTripStore } from "@/stores/useTripStore";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import ItineraryItemCard from "./ItineraryItemCard";
const AddItemDialog = lazy(() => import("./AddItemDialog"));
import TripSettingsModal from "./TripSettingsModal";
const SmartPullInbox = lazy(() => import("./SmartPullInbox"));
const EditTripDialog = lazy(() => import("./EditTripDialog"));
import OrphanItemsBanner from "./OrphanItemsBanner";
import type { ItineraryItem } from "@/stores/useTripStore";
import { toast } from "sonner";
import { suggestFixesForConflicts, type ConflictFix } from "@/lib/conflictResolution";
import { Inbox, Lock, Globe, ChevronLeft, ChevronRight, Pencil, Settings, ChevronDown } from "lucide-react";
import { Undo2, Redo2, Shuffle } from "lucide-react";
import type { StudioItem } from "@/stores/useStudioStore";
import ShareControls from "./ShareControls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CalendarStaysView from "./CalendarStaysView";
import LocationLegDialog from "./LocationLegDialog";
import {
  getLegs,
  getGhostLegsFromStays,
  legColumnSpan,
  legOverlaps,
  formatLegLabel,
  getStayPills,
  assignLanes,
  type StayPill,
  type LocationLeg,
} from "@/lib/locationLegs";
import { MapPin, Sparkles, Bed, CalendarIcon, GripVertical } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildSegments, computeReorderPatches } from "@/lib/segments";
import { differenceInCalendarDays, addDays } from "date-fns";
const EditItemDialog = lazy(() => import("./EditItemDialog"));
import ReshuffleLegsList from "./ReshuffleLegsList";

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

/** 7-stop rainbow palette token names; cycles for >7 legs. */
const LEG_TOKENS = [
  "--leg-1",
  "--leg-2",
  "--leg-3",
  "--leg-4",
  "--leg-5",
  "--leg-6",
  "--leg-7",
];

export default function MatrixGrid() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const createItineraryItem = useTripStore((s) => s.createItineraryItem);
  const updateItineraryItem = useTripStore((s) => s.updateItineraryItem);
  const updateTrip = useTripStore((s) => s.updateTrip);
  const moveItineraryItem = useTripStore((s) => s.moveItineraryItem);
  const shiftTripDates = useTripStore((s) => s.shiftTripDates);
  const bulkUpdateItemDates = useTripStore((s) => s.bulkUpdateItemDates);
  const undo = useTripStore((s) => s.undo);
  const redo = useTripStore((s) => s.redo);
  const canUndo = useTripStore((s) => s.canUndo());
  const canRedo = useTripStore((s) => s.canRedo());

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

      // Trackpad vs mouse-wheel detection.
      // Mouse wheel: discrete integer deltaY, no deltaX, large magnitude (or line-mode).
      // Trackpad / precision: small/fractional deltas, often with a deltaX component.
      const isMouseWheel =
        e.deltaMode === 1 ||
        (e.deltaX === 0 &&
          Math.abs(e.deltaY) >= 50 &&
          Number.isInteger(e.deltaY));

      if (!isMouseWheel) {
        // Trackpad: cancel any lingering eased animation so it doesn't fight
        // native momentum, then let the browser handle everything natively
        // (horizontal two-finger swipe → native horizontal scroll on this
        // overflow-auto container; vertical swipe → page scroll).
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
          lastTs = 0;
        }
        return;
      }

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

  /* ---- Location leg dialog state ---- */
  const [legDialog, setLegDialog] = useState<{
    open: boolean;
    leg: LocationLeg | null;
    initialStart: string;
  }>({ open: false, leg: null, initialStart: "" });

  /* ---- Stay pill edit dialog state ---- */
  const [stayEdit, setStayEdit] = useState<{ open: boolean; item: ItineraryItem | null }>({
    open: false,
    item: null,
  });

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

  const conflictFixes = useMemo(() => {
    const m = new Map<string, ConflictFix>();
    for (const f of suggestFixesForConflicts(itineraryItems)) m.set(f.itemId, f);
    return m;
  }, [itineraryItems]);

  const handleApplyFix = useCallback(
    async (fix: ConflictFix) => {
      if (fix.kind === "shift_time") {
        await updateItineraryItem(fix.itemId, {
          start_time: fix.newStart,
          end_time: fix.newEnd,
        });
        toast.success("Conflict resolved", { description: fix.reason });
      } else if (fix.kind === "move_day") {
        await updateItineraryItem(fix.itemId, { date: fix.newDate });
        toast.success("Conflict resolved", { description: fix.reason });
      }
    },
    [updateItineraryItem],
  );

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
      // In-grid move (cross-day or cross-category)
      const itemId = e.dataTransfer.getData("application/itinerary-item");
      if (itemId && activeTrip) {
        e.preventDefault();
        const existing = itineraryItems.find((i) => i.id === itemId);
        if (!existing) return;
        if (existing.date === dateStr && existing.category === category) return;
        await moveItineraryItem(itemId, { date: dateStr, category });
        toast.success(`Moved "${existing.title}" to ${format(parseISO(dateStr), "MMM d")}`);
        return;
      }

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

        // Validation: warn when stay is missing geographic anchor (breaks proximity)
        if (mappedCategory === "stays" && !studioItem.google_place_id) {
          toast.warning("Stay added without a verified location — open the card to set it.");
        }
        // Validation: warn when the user dropped onto a row that doesn't match the studio category
        if (mappedCategory !== category) {
          toast.message(
            `Placed in ${mappedCategory.replace("_", " ")} row — that's where ${studioItem.category} items belong.`,
          );
        }

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
    [activeTrip, createItineraryItem, moveItineraryItem, itineraryItems]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes("application/studio-item") ||
      e.dataTransfer.types.includes("application/itinerary-item")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes("application/itinerary-item")
        ? "move"
        : "copy";
    }
  }, []);

  // Keyboard shortcuts: ⌘Z / ⇧⌘Z (or Ctrl on win)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /* ---- Location legs (real + ghost-derived from stays) ---- */
  const legs = useMemo(() => getLegs(itineraryItems), [itineraryItems]);
  const ghostLegs = useMemo(
    () => (activeTrip && legs.length === 0 ? getGhostLegsFromStays(activeTrip, itineraryItems) : []),
    [activeTrip, itineraryItems, legs.length],
  );
  const displayedLegs: LocationLeg[] = legs.length > 0 ? legs : ghostLegs;

  /* ---- Per-day leg color (vertical rainbow bands) ---- */
  const dayLegColor = useMemo(() => {
    const map = new Map<string, string>(); // dateStr -> hsl token name
    const sorted = displayedLegs.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
    sorted.forEach((leg, idx) => {
      const token = LEG_TOKENS[idx % LEG_TOKENS.length];
      const start = parseISO(leg.startDate);
      const end = parseISO(leg.endDate);
      const span = Math.max(1, differenceInCalendarDays(end, start) + 1);
      for (let i = 0; i < span; i++) {
        map.set(format(addDays(start, i), "yyyy-MM-dd"), token);
      }
    });
    return map;
  }, [displayedLegs]);

  const legTokenById = useMemo(() => {
    const m = new Map<string, string>();
    const sorted = displayedLegs.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
    sorted.forEach((leg, idx) => m.set(leg.id, LEG_TOKENS[idx % LEG_TOKENS.length]));
    return m;
  }, [displayedLegs]);

  /** Tailwind-arbitrary inline style for a day column cell tint. */
  const cellStyleFor = (dateStr: string): React.CSSProperties => {
    const token = dayLegColor.get(dateStr);
    if (!token) return {};
    return { backgroundColor: `hsl(var(${token}) / 0.10)` };
  };

  /* ---- Drag-to-reorder location legs (swap on drop) ---- */
  const [draggingLegId, setDraggingLegId] = useState<string | null>(null);

  const handleLegReorderSwap = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!activeTrip || sourceId === targetId) return;
      const segs = buildSegments(activeTrip, itineraryItems);
      if (segs.length < 2) {
        toast.error("Need at least two segments to reorder.");
        return;
      }
      // Match leg → segment by date overlap (legs and segments share startDate windows).
      const findSegIdxForLeg = (legId: string) => {
        const leg = displayedLegs.find((l) => l.id === legId);
        if (!leg) return -1;
        return segs.findIndex(
          (s) => !(s.endDate < leg.startDate || s.startDate > leg.endDate),
        );
      };
      const a = findSegIdxForLeg(sourceId);
      const b = findSegIdxForLeg(targetId);
      if (a < 0 || b < 0) {
        toast.error("Couldn't match legs to itinerary segments.");
        return;
      }
      const newOrder = segs.slice();
      const [moved] = newOrder.splice(a, 1);
      newOrder.splice(b, 0, moved);
      const patches = computeReorderPatches(activeTrip, newOrder, itineraryItems);
      if (patches.length === 0) {
        toast.message("Order unchanged.");
        return;
      }
      await bulkUpdateItemDates(patches);
      toast.success("Legs reshuffled");
    },
    [activeTrip, itineraryItems, displayedLegs, bulkUpdateItemDates],
  );

  /* ---- Stay pills (consecutive same-stay grouping) ---- */
  const stayPills = useMemo(() => getStayPills(itineraryItems), [itineraryItems]);
  const stayLanes = useMemo(() => assignLanes(stayPills), [stayPills]);
  const stayPillLane = useMemo(() => {
    const m = new Map<string, number>();
    for (const { pill, lane } of stayLanes) m.set(pill.id, lane);
    return m;
  }, [stayLanes]);
  const maxStayLane = stayLanes.reduce((m, x) => Math.max(m, x.lane), -1);
  const STAY_LANE_H = 28;
  const staysRowHeight = Math.max(112, (maxStayLane + 1) * STAY_LANE_H + 16);

  const handleSaveLeg = useCallback(
    async (data: {
      id?: string;
      city: string;
      state: string | null;
      country: string | null;
      googlePlaceId: string | null;
      startDate: string;
      nights: number;
    }) => {
      if (!activeTrip) return;
      const endDate = format(
        new Date(parseISO(data.startDate).getTime() + (data.nights - 1) * 86400000),
        "yyyy-MM-dd",
      );
      // Block overlaps with other real legs
      const conflict = legs.some(
        (l) =>
          l.id !== data.id &&
          legOverlaps(data.startDate, endDate, l.startDate, l.endDate),
      );
      if (conflict) {
        toast.error("Overlaps another location leg — adjust dates.");
        return;
      }
      const title = formatLegLabel(data.city, data.state, data.country);
      const payload: Partial<ItineraryItem> = {
        trip_id: activeTrip.id,
        category: "location",
        title,
        location_name: data.city,
        google_place_id: data.googlePlaceId,
        date: data.startDate,
        approval_status: "confirmed",
        metadata: {
          end_date: endDate,
          city: data.city,
          state: data.state,
          country: data.country,
        },
      };
      if (data.id) {
        await updateItineraryItem(data.id, payload);
        toast.success("Location updated");
      } else {
        await createItineraryItem(payload);
        toast.success("Location added");
      }
    },
    [activeTrip, legs, createItineraryItem, updateItineraryItem],
  );

  const handleDeleteLeg = useCallback(
    async (id: string) => {
      await useTripStore.getState().deleteItineraryItem(id);
      toast.success("Location removed");
    },
    [],
  );

  const confirmGhostLegs = useCallback(async () => {
    if (!activeTrip || ghostLegs.length === 0) return;
    for (const g of ghostLegs) {
      await createItineraryItem({
        trip_id: activeTrip.id,
        category: "location",
        title: g.city,
        location_name: g.city,
        date: g.startDate,
        approval_status: "confirmed",
        metadata: { end_date: g.endDate, city: g.city, state: null, country: null },
      });
    }
    toast.success(`Confirmed ${ghostLegs.length} location ${ghostLegs.length === 1 ? "leg" : "legs"}`);
  }, [activeTrip, ghostLegs, createItineraryItem]);

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
            <div className="hidden sm:flex items-center gap-1 border-l border-border pl-2 ml-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canUndo}
                onClick={() => undo()}
                title="Undo (⌘Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canRedo}
                onClick={() => redo()}
                title="Redo (⇧⌘Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ShareControls />
            <EditTripButton />
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
            {activeTrip?.start_date && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="ml-3 inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 font-inter text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/5"
                    title="Change start date — shifts the entire trip"
                  >
                    <CalendarIcon className="h-3 w-3" />
                    Trip starts: {format(parseISO(activeTrip.start_date), "MMM d, yyyy")}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(activeTrip.start_date)}
                    onSelect={async (d) => {
                      if (!d || !activeTrip.start_date) return;
                      const delta = differenceInCalendarDays(d, parseISO(activeTrip.start_date));
                      if (delta === 0) return;
                      const ok = await shiftTripDates(activeTrip.id, delta);
                      if (ok) {
                        toast.success(
                          `Trip shifted ${delta > 0 ? "+" : ""}${delta} day${
                            Math.abs(delta) === 1 ? "" : "s"
                          }`,
                        );
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
            {activeTrip && (
              <Popover open={reshuffleOpen} onOpenChange={setReshuffleOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 font-inter text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/5"
                    title="Reshuffle legs — reorder locations without dragging across the grid"
                  >
                    <Shuffle className="h-3 w-3" />
                    Reshuffle legs
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <ReshuffleLegsList
                    trip={activeTrip}
                    items={itineraryItems}
                    onApply={async (patches) => {
                      if (patches.length > 0) await bulkUpdateItemDates(patches);
                    }}
                    onClose={() => setReshuffleOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            )}
            {ghostLegs.length > 0 && (
              <button
                type="button"
                onClick={confirmGhostLegs}
                className="ml-3 inline-flex items-center gap-1 rounded-sm border border-dashed border-accent/50 px-2 py-1 font-inter text-[10px] text-accent hover:bg-accent/10"
                title="Persist the suggested location row derived from your stays"
              >
                <Sparkles className="h-3 w-3" />
                Confirm {ghostLegs.length} location {ghostLegs.length === 1 ? "leg" : "legs"}
              </button>
            )}
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
      <>
      <OrphanItemsBanner />
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
            {/* LOCATION row label */}
            <div className="flex h-9 items-center gap-1 border-b border-border px-3">
              <MapPin className="h-3 w-3 text-accent" strokeWidth={1.5} />
              <span className="font-inter text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Location
              </span>
            </div>
            {CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="flex items-center border-b border-border px-3"
                style={{
                  height: cat.key === "stays" ? `${staysRowHeight}px` : "112px",
                }}
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

          {/* Day columns wrapper (relative — hosts the absolute leg-pill overlay) */}
          <div className="relative flex">
            {/* Absolute leg-pill overlay: top is below the 40px date header, height matches the location row */}
            <div
              className="pointer-events-none absolute left-0 top-10 z-10 h-9"
              style={{ width: `${days.length * 176}px` }}
            >
              {displayedLegs.map((leg) => {
                if (!activeTrip?.start_date) return null;
                const { startIdx, span } = legColumnSpan(activeTrip.start_date, leg);
                if (startIdx < 0 || startIdx >= days.length) return null;
                const width = Math.min(span, days.length - startIdx) * 176;
                const token = legTokenById.get(leg.id);
                const isDragging = draggingLegId === leg.id;
                return (
                  <button
                    key={leg.id}
                    type="button"
                    draggable={!leg.isGhost}
                    onDragStart={(e) => {
                      if (leg.isGhost) return;
                      setDraggingLegId(leg.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("application/leg-id", leg.id);
                    }}
                    onDragEnd={() => setDraggingLegId(null)}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes("application/leg-id")) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      const src = e.dataTransfer.getData("application/leg-id");
                      if (!src) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingLegId(null);
                      handleLegReorderSwap(src, leg.id);
                    }}
                    onClick={() =>
                      setLegDialog({
                        open: true,
                        leg: leg.isGhost ? null : leg,
                        initialStart: leg.startDate,
                      })
                    }
                    data-no-pan
                    className={`pointer-events-auto absolute top-1 flex h-7 items-center gap-1.5 truncate rounded-sm px-2.5 text-left transition-all ${
                      leg.isGhost
                        ? "border border-dashed italic"
                        : "border cursor-grab active:cursor-grabbing"
                    } ${isDragging ? "opacity-40 ring-2 ring-accent" : ""}`}
                    style={{
                      left: `${startIdx * 176 + 4}px`,
                      width: `${width - 8}px`,
                      backgroundColor: token
                        ? `hsl(var(${token}) / ${leg.isGhost ? 0.12 : 0.28})`
                        : undefined,
                      borderColor: token ? `hsl(var(${token}) / 0.55)` : undefined,
                      color: "hsl(var(--foreground))",
                    }}
                    title={
                      leg.isGhost
                        ? "Derived from stays — click to refine"
                        : `${leg.label} — drag to reorder, click to edit`
                    }
                  >
                    {!leg.isGhost && (
                      <GripVertical className="h-3 w-3 shrink-0 opacity-50" strokeWidth={1.5} />
                    )}
                    <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                    <span className="truncate font-inter text-[11px] font-medium">
                      {leg.label} · {leg.nights}n
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Absolute stay-pill overlay over the Stays row */}
            <div
              className="pointer-events-none absolute left-0 z-10"
              style={{
                top: `${40 + 36}px`, // date header (40) + location row (36)
                width: `${days.length * 176}px`,
                height: `${staysRowHeight}px`,
              }}
            >
              {stayLanes.map(({ pill, lane }) => {
                if (!activeTrip?.start_date) return null;
                const { startIdx, span } = legColumnSpan(activeTrip.start_date, pill);
                if (startIdx < 0 || startIdx >= days.length) return null;
                const width = Math.min(span, days.length - startIdx) * 176;
                const hasConflict = pill.itemIds.some((id) => conflictIds.has(id));
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStayEdit({ open: true, item: pill.firstItem })}
                    className={`pointer-events-auto absolute flex h-6 items-center gap-1.5 truncate rounded-sm border px-2.5 text-left transition-colors ${
                      hasConflict
                        ? "border-destructive/70 bg-destructive/10 ring-1 ring-destructive/40 hover:bg-destructive/20"
                        : "border-accent/60 bg-accent/15 text-foreground hover:bg-accent/25"
                    }`}
                    style={{
                      left: `${startIdx * 176 + 4}px`,
                      width: `${width - 8}px`,
                      top: `${lane * STAY_LANE_H + 6}px`,
                    }}
                    title={`${pill.title}${pill.locationName ? ` · ${pill.locationName}` : ""} · ${pill.nights} night${pill.nights === 1 ? "" : "s"}`}
                  >
                    <Bed className="h-3 w-3 shrink-0 text-accent" strokeWidth={1.5} />
                    <span className="truncate font-inter text-[11px] font-medium">
                      {pill.title} · {pill.nights}n
                    </span>
                  </button>
                );
              })}
            </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const total = dailyTotals[dateStr] || 0;
            const cellHasLeg = displayedLegs.some(
              (l) => dateStr >= l.startDate && dateStr <= l.endDate,
            );
            const isFirstDay = !!activeTrip?.start_date && dateStr === activeTrip.start_date;
            return (
              <div key={dateStr} className="w-44 shrink-0 border-r border-border last:border-r-0">
                <div className="sticky top-0 z-10 flex h-10 items-center justify-center border-b border-border bg-secondary/40 backdrop-blur-sm">
                  {isFirstDay ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          title="Click to shift entire trip to a new start date"
                          className="group inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-inter text-[11px] font-medium text-foreground decoration-dotted underline-offset-4 hover:bg-accent/10 hover:text-accent hover:underline"
                        >
                          {format(day, "EEE, MMM d")}
                          <Pencil className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseISO(activeTrip!.start_date!)}
                          onSelect={async (d) => {
                            if (!d || !activeTrip?.start_date) return;
                            const delta = differenceInCalendarDays(d, parseISO(activeTrip.start_date));
                            if (delta === 0) return;
                            const ok = await shiftTripDates(activeTrip.id, delta);
                            if (ok) {
                              toast.success(
                                `Trip shifted ${delta > 0 ? "+" : ""}${delta} day${
                                  Math.abs(delta) === 1 ? "" : "s"
                                }`,
                              );
                            }
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="font-inter text-[11px] font-medium text-foreground">
                      {format(day, "EEE, MMM d")}
                    </span>
                  )}
                </div>

                {/* LOCATION cell (visible only when no leg pill covers this day) */}
                <div
                  className="h-9 border-b border-border"
                  style={cellStyleFor(dateStr)}
                >
                  {!cellHasLeg && (
                    <button
                      type="button"
                      onClick={() =>
                        setLegDialog({ open: true, leg: null, initialStart: dateStr })
                      }
                      className="flex h-full w-full items-center justify-center font-inter text-[10px] text-muted-foreground/50 hover:bg-accent/5 hover:text-accent"
                    >
                      + Location
                    </button>
                  )}
                </div>

                {CATEGORIES.map((cat) => {
                  const cellItems = itineraryItems.filter(
                    (item) => item.date === dateStr && item.category === cat.key
                  );
                  const isStays = cat.key === "stays";
                  return (
                    <div
                      key={cat.key}
                      className="flex flex-col gap-1 border-b border-border p-1.5 overflow-y-auto"
                      style={{
                        height: isStays ? `${staysRowHeight}px` : "112px",
                        ...cellStyleFor(dateStr),
                      }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dateStr, cat.key)}
                    >
                      {!isStays &&
                        cellItems.map((item) => (
                          <ItineraryItemCard
                            key={item.id}
                            item={item}
                            hasConflict={conflictIds.has(item.id)}
                            fix={conflictFixes.get(item.id) ?? null}
                            onApplyFix={handleApplyFix}
                          />
                        ))}
                      <button
                        onClick={() => openAdd(dateStr, cat.key)}
                        className={`flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border/60 py-1 min-h-[44px] transition-colors hover:border-accent/50 hover:bg-accent/5 touch-manipulation ${
                          isStays ? "mt-auto" : ""
                        }`}
                      >
                        <span className="font-inter text-[10px] text-muted-foreground/60 hover:text-accent">
                          + Add
                        </span>
                      </button>
                    </div>
                  );
                })}

                <div
                  className="flex h-8 items-center justify-center border-b border-border"
                  style={cellStyleFor(dateStr)}
                >
                  <span className="font-inter text-[10px] font-semibold text-foreground">
                    {total > 0 ? `$${total.toLocaleString()}` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
      </>
      )}

      {activeTrip && dialogState.open && (
        <Suspense fallback={null}>
          <AddItemDialog
            open={dialogState.open}
            onOpenChange={(open) => setDialogState((s) => ({ ...s, open }))}
            tripId={activeTrip.id}
            date={dialogState.date}
            category={dialogState.category}
          />
        </Suspense>
      )}

      {activeTrip?.start_date && activeTrip?.end_date && legDialog.open && (
        <LocationLegDialog
          open={legDialog.open}
          onOpenChange={(open) => setLegDialog((s) => ({ ...s, open }))}
          tripStart={activeTrip.start_date}
          tripEnd={activeTrip.end_date}
          leg={legDialog.leg}
          initialStart={legDialog.initialStart}
          onSave={handleSaveLeg}
          onDelete={handleDeleteLeg}
        />
      )}

      {/* Smart Pull Inbox: paste · review · history · diff · batch */}
      {smartPullOpen && (
        <Suspense fallback={null}>
          <SmartPullInbox open={smartPullOpen} onOpenChange={setSmartPullOpen} />
        </Suspense>
      )}

      {stayEdit.open && stayEdit.item && (
        <Suspense fallback={null}>
          <EditItemDialog
            open={stayEdit.open}
            onOpenChange={(open) => setStayEdit((s) => ({ ...s, open }))}
            item={stayEdit.item}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ---------- Edit Trip trigger (button + dialog) ---------- */
function EditTripButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 font-inter text-[11px] text-muted-foreground"
        onClick={() => setOpen(true)}
        title="Edit dates & segments"
      >
        <Pencil className="h-3 w-3" />
        Edit Trip
      </Button>
      {open && (
        <Suspense fallback={null}>
          <EditTripDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
