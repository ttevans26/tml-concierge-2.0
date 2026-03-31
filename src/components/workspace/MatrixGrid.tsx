import { useMemo, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTripStore } from "@/stores/useTripStore";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import ItineraryItemCard from "./ItineraryItemCard";
import AddItemDialog from "./AddItemDialog";
import type { ItineraryItem } from "@/stores/useTripStore";

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
  // Group by date+category
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

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    date: string;
    category: ItineraryItem["category"];
  }>({ open: false, date: "", category: "activity" });

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

  // Conflict detection
  const conflictIds = useMemo(() => detectConflicts(itineraryItems), [itineraryItems]);

  // Compute daily totals (must be before early return)
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
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Matrix Grid
        </h2>
        <p className="mt-0.5 font-inter text-[11px] text-muted-foreground">
          {days.length} day{days.length !== 1 ? "s" : ""} · {format(days[0], "MMM d")} — {format(days[days.length - 1], "MMM d, yyyy")}
        </p>
      </div>

      {/* Scrollable matrix */}
      <ScrollArea className="flex-1">
        <div className="flex min-w-max">
          {/* Category labels column — sticky left */}
          <div className="sticky left-0 z-20 w-24 shrink-0 border-r border-border bg-card">
            {/* Corner cell matching date header */}
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
            {/* Daily total label */}
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
                {/* Day header — sticky top */}
                <div className="sticky top-0 z-10 flex h-10 items-center justify-center border-b border-border bg-secondary/40 backdrop-blur-sm">
                  <span className="font-inter text-[11px] font-medium text-foreground">
                    {format(day, "EEE, MMM d")}
                  </span>
                </div>

                {/* Category cells */}
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
                    >
                      {cellItems.map((item) => (
                        <ItineraryItemCard key={item.id} item={item} hasConflict={conflictIds.has(item.id)} />
                      ))}
                      {/* Add button: hidden for stays if occupied */}
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

                {/* Daily total row */}
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
    </div>
  );
}
