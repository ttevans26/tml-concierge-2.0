import { useMemo, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTripStore } from "@/stores/useTripStore";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import ItineraryItemCard from "./ItineraryItemCard";
import AddItemDialog from "./AddItemDialog";
import type { ItineraryItem } from "@/stores/useTripStore";

const CATEGORIES = [
  { key: "stays" as const, label: "Stays" },
  { key: "logistics" as const, label: "Logistics" },
  { key: "dining" as const, label: "Dining" },
  { key: "agenda" as const, label: "Agenda" },
];

export default function MatrixGrid() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    date: string;
    category: ItineraryItem["category"];
  }>({ open: false, date: "", category: "agenda" });

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
          {/* Category labels column */}
          <div className="sticky left-0 z-10 w-24 shrink-0 border-r border-border bg-card">
            <div className="h-10 border-b border-border" />
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
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            return (
              <div key={dateStr} className="w-44 shrink-0 border-r border-border last:border-r-0">
                {/* Day header */}
                <div className="flex h-10 items-center justify-center border-b border-border bg-secondary/40">
                  <span className="font-inter text-[11px] font-medium text-foreground">
                    {format(day, "EEE, MMM d")}
                  </span>
                </div>

                {/* Category cells */}
                {CATEGORIES.map((cat) => {
                  const cellItems = itineraryItems.filter(
                    (item) => item.date === dateStr && item.category === cat.key
                  );
                  return (
                    <div
                      key={cat.key}
                      className="flex h-28 flex-col gap-1 border-b border-border p-1.5 overflow-y-auto"
                    >
                      {cellItems.map((item) => (
                        <ItineraryItemCard key={item.id} item={item} />
                      ))}
                      {/* Add button */}
                      <button
                        onClick={() => openAdd(dateStr, cat.key)}
                        className="flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border/60 py-1 transition-colors hover:border-accent/50 hover:bg-accent/5"
                      >
                        <span className="font-inter text-[10px] text-muted-foreground/60 hover:text-accent">
                          + Add
                        </span>
                      </button>
                    </div>
                  );
                })}
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
