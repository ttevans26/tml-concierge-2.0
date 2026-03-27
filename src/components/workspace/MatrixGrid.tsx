import { useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTripStore } from "@/stores/useTripStore";
import { format, eachDayOfInterval, parseISO } from "date-fns";

const CATEGORIES = [
  { key: "stays", label: "Stays" },
  { key: "logistics", label: "Logistics" },
  { key: "dining", label: "Dining" },
  { key: "agenda", label: "Agenda" },
] as const;

export default function MatrixGrid() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);

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
            {/* Spacer for day header row */}
            <div className="h-10 border-b border-border" />
            {CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="flex h-24 items-center border-b border-border px-3"
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
              <div key={dateStr} className="w-40 shrink-0 border-r border-border last:border-r-0">
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
                      className="flex h-24 flex-col gap-1 border-b border-border p-1.5"
                    >
                      {cellItems.length === 0 ? (
                        <div className="flex h-full items-center justify-center rounded-sm border border-dashed border-border/60">
                          <span className="font-inter text-[10px] text-muted-foreground/50">+</span>
                        </div>
                      ) : (
                        cellItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-sm border-thin border-border bg-card px-2 py-1"
                          >
                            <p className="truncate font-inter text-[10px] font-medium text-foreground">
                              {item.title}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
