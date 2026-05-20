import { useMemo } from "react";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { Bed, Plane, UtensilsCrossed, Compass } from "lucide-react";
import type { NetworkTripItem, NetworkTripSummary } from "@/stores/useTripStore";

interface Props {
  trip: NetworkTripSummary;
  items: NetworkTripItem[];
}

const CATEGORIES = [
  { key: "stays", label: "Stays", icon: Bed, bg: "bg-[hsl(var(--cell-stays))]" },
  { key: "logistics", label: "Logistics", icon: Plane, bg: "bg-[hsl(var(--cell-logistics))]" },
  { key: "dining", label: "Dining", icon: UtensilsCrossed, bg: "bg-[hsl(var(--cell-dining))]" },
  { key: "activity", label: "Activity", icon: Compass, bg: "bg-[hsl(var(--cell-activity))]" },
] as const;

export default function ReadOnlyMatrixGrid({ trip, items }: Props) {
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: parseISO(trip.start_date),
        end: parseISO(trip.end_date),
      }),
    [trip.start_date, trip.end_date],
  );

  const itemsByCell = useMemo(() => {
    const map = new Map<string, NetworkTripItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const key = `${item.category}|${item.date}`;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  return (
    <div className="overflow-x-auto border-thin border-foreground/15 bg-card rounded-sm">
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `140px repeat(${days.length}, minmax(180px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="border-b border-foreground/10 bg-secondary/40 px-3 py-2 font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
          Day
        </div>
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className="border-b border-l border-foreground/10 bg-secondary/40 px-3 py-2"
          >
            <div className="font-playfair text-sm font-semibold text-foreground">
              {format(d, "EEE d")}
            </div>
            <div className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
              {format(d, "MMM yyyy")}
            </div>
          </div>
        ))}

        {/* Category rows */}
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <div key={cat.key} className="contents">
              <div className="flex items-center gap-2 border-b border-foreground/10 bg-background px-3 py-3">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-inter text-xs font-medium text-foreground">
                  {cat.label}
                </span>
              </div>
              {days.map((d) => {
                const dateKey = format(d, "yyyy-MM-dd");
                const cellItems = itemsByCell.get(`${cat.key}|${dateKey}`) ?? [];
                return (
                  <div
                    key={`${cat.key}-${dateKey}`}
                    className={`border-b border-l border-foreground/10 ${cat.bg} p-2 flex flex-col gap-1.5 min-h-[88px]`}
                  >
                    {cellItems.map((item) => (
                      <div
                        key={item.id}
                        className="border-thin border-foreground/20 bg-card/90 px-2 py-1.5 rounded-sm"
                      >
                        <div className="font-playfair text-xs font-semibold text-foreground leading-tight">
                          {item.title}
                        </div>
                        {item.location_name && (
                          <div className="font-inter text-[10px] text-muted-foreground truncate">
                            {item.location_name}
                          </div>
                        )}
                        {(item.start_time || item.end_time) && (
                          <div className="font-inter text-[10px] text-muted-foreground">
                            {item.start_time ?? ""}
                            {item.end_time ? ` – ${item.end_time}` : ""}
                          </div>
                        )}
                        {item.description && (
                          <div className="font-inter text-[10px] text-foreground/70 mt-1 line-clamp-2">
                            {item.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}