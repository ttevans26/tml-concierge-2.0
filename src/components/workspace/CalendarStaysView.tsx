import { useMemo, useState } from "react";
import {
  parseISO,
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  differenceInCalendarDays,
  addDays,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { useTripStore } from "@/stores/useTripStore";
import type { ItineraryItem } from "@/stores/useTripStore";
import EditItemDialog from "./EditItemDialog";

/* ---------- Color palette (Quiet Luxury, semantic HSL) ---------- */
/* Kept inline because these are content-driven (per-stay) tokens, not theme */
const STAY_PALETTE: { bg: string; text: string; border: string }[] = [
  { bg: "hsl(142 25% 55% / 0.85)", text: "hsl(142 30% 18%)", border: "hsl(142 25% 45%)" }, // sage
  { bg: "hsl(15 45% 62% / 0.85)",  text: "hsl(15 40% 20%)",  border: "hsl(15 45% 50%)"  }, // terracotta
  { bg: "hsl(215 22% 55% / 0.85)", text: "hsl(215 30% 18%)", border: "hsl(215 22% 45%)" }, // slate blue
  { bg: "hsl(40 50% 58% / 0.85)",  text: "hsl(40 45% 20%)",  border: "hsl(40 50% 45%)"  }, // ochre
  { bg: "hsl(350 30% 68% / 0.85)", text: "hsl(350 35% 22%)", border: "hsl(350 30% 55%)" }, // dusty rose
  { bg: "hsl(260 22% 62% / 0.85)", text: "hsl(260 30% 20%)", border: "hsl(260 22% 50%)" }, // lavender
  { bg: "hsl(185 28% 50% / 0.85)", text: "hsl(185 35% 15%)", border: "hsl(185 28% 40%)" }, // teal
  { bg: "hsl(36 45% 50% / 0.85)",  text: "hsl(36 50% 18%)",  border: "hsl(36 45% 38%)"  }, // bronze
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

/* ---------- Stay segment grouping ---------- */
interface StaySegment {
  key: string;
  title: string;
  location: string | null;
  startDate: Date;
  endDate: Date; // last night (inclusive)
  items: ItineraryItem[];
  colorIndex: number;
}

function groupStays(items: ItineraryItem[]): StaySegment[] {
  const stays = items
    .filter((i) => i.category === "stays" && i.date)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));

  const segments: StaySegment[] = [];
  for (const item of stays) {
    const key = `${item.title}|${item.location_name || ""}`;
    const date = parseISO(item.date!);
    const last = segments[segments.length - 1];
    if (
      last &&
      last.key === key &&
      differenceInCalendarDays(date, last.endDate) === 1
    ) {
      last.endDate = date;
      last.items.push(item);
    } else {
      segments.push({
        key,
        title: item.title,
        location: item.location_name,
        startDate: date,
        endDate: date,
        items: [item],
        colorIndex: hashIndex(key, STAY_PALETTE.length),
      });
    }
  }
  return segments;
}

/* ---------- Component ---------- */
export default function CalendarStaysView() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);

  const segments = useMemo(() => groupStays(itineraryItems), [itineraryItems]);

  const { tripStart, tripEnd, weeks } = useMemo(() => {
    if (!activeTrip?.start_date || !activeTrip?.end_date) {
      return { tripStart: null, tripEnd: null, weeks: [] as Date[][] };
    }
    const ts = parseISO(activeTrip.start_date);
    const te = parseISO(activeTrip.end_date);
    const gridStart = startOfWeek(ts, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(te, { weekStartsOn: 0 });
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const w: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) w.push(allDays.slice(i, i + 7));
    return { tripStart: ts, tripEnd: te, weeks: w };
  }, [activeTrip?.start_date, activeTrip?.end_date]);

  if (!activeTrip || !tripStart || !tripEnd) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <h3 className="font-playfair text-lg font-semibold text-foreground">No dates set</h3>
        <p className="mt-2 max-w-xs font-inter text-xs text-muted-foreground leading-relaxed">
          Add start and end dates to your trip to see the calendar view.
        </p>
      </div>
    );
  }

  /* Per-week segment slices */
  const segmentsByWeek = (week: Date[]) => {
    const wkStart = week[0];
    const wkEnd = week[6];
    return segments
      .filter((s) => s.startDate <= wkEnd && s.endDate >= wkStart)
      .map((s) => {
        const sliceStart = s.startDate < wkStart ? wkStart : s.startDate;
        const sliceEnd = s.endDate > wkEnd ? wkEnd : s.endDate;
        const colStart = differenceInCalendarDays(sliceStart, wkStart); // 0..6
        const colSpan = differenceInCalendarDays(sliceEnd, sliceStart) + 1;
        return {
          seg: s,
          colStart,
          colSpan,
          isStartInWeek: isSameDay(sliceStart, s.startDate),
          isEndInWeek: isSameDay(sliceEnd, s.endDate),
        };
      });
  };

  /* Stack lane assignment within a week (handles overlap on transition days) */
  function assignLanes<T extends { colStart: number; colSpan: number }>(slices: T[]) {
    const lanes: number[][] = []; // lane => list of end columns
    return slices.map((sl) => {
      const sliceEndCol = sl.colStart + sl.colSpan - 1;
      let lane = 0;
      while (true) {
        const occ = lanes[lane] || [];
        const overlaps = occ.some((endCol, i) => {
          const startCol = (lanes[lane] as any)._starts?.[i] ?? 0;
          return !(sl.colStart > endCol || sliceEndCol < startCol);
        });
        if (!overlaps) {
          if (!lanes[lane]) {
            lanes[lane] = [];
            (lanes[lane] as any)._starts = [];
          }
          lanes[lane].push(sliceEndCol);
          (lanes[lane] as any)._starts.push(sl.colStart);
          return { ...sl, lane };
        }
        lane++;
      }
    });
  }

  const isInTrip = (d: Date) =>
    isWithinInterval(d, { start: tripStart, end: tripEnd });

  const dayOfWeekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Trip date subtitle */}
      <div className="shrink-0 border-b border-border px-4 py-2">
        <p className="font-inter text-[11px] text-muted-foreground">
          {format(tripStart, "MMM d")} — {format(tripEnd, "MMM d, yyyy")} · {segments.length} stay{segments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Mobile: agenda list */}
      <div className="flex-1 overflow-y-auto sm:hidden p-3 space-y-2">
        {segments.length === 0 && (
          <p className="text-center font-inter text-xs text-muted-foreground py-8">
            No stays added yet. Add a stay in the Matrix view to see it here.
          </p>
        )}
        {segments.map((s) => {
          const c = STAY_PALETTE[s.colorIndex];
          const nights = differenceInCalendarDays(s.endDate, s.startDate) + 1;
          return (
            <button
              key={s.key + s.startDate.toISOString()}
              onClick={() => setEditing(s.items[0])}
              className="w-full text-left rounded-sm px-3 py-2.5 border min-h-[44px] touch-manipulation transition-opacity hover:opacity-90"
              style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
            >
              <div className="font-playfair text-sm font-semibold leading-tight">{s.title}</div>
              <div className="font-inter text-[10px] mt-0.5 opacity-90">
                {format(s.startDate, "EEE, MMM d")} → {format(addDays(s.endDate, 1), "EEE, MMM d")} · {nights} night{nights !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop: month-style grid */}
      <div className="hidden sm:flex flex-1 flex-col overflow-y-auto">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-secondary/40 sticky top-0 z-10">
          {dayOfWeekLabels.map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 font-inter text-[10px] font-medium uppercase tracking-widest text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        <div className="flex-1">
          {weeks.map((week, wi) => {
            const slices = assignLanes(segmentsByWeek(week));
            const laneCount = Math.max(1, ...slices.map((s) => s.lane + 1));
            const rowMinHeight = 88 + Math.max(0, laneCount - 1) * 28;

            return (
              <div
                key={wi}
                className="relative border-b border-border last:border-b-0"
                style={{ minHeight: `${rowMinHeight}px` }}
              >
                {/* Day cells */}
                <div className="grid grid-cols-7 h-full">
                  {week.map((day) => {
                    const inTrip = isInTrip(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`border-r border-border last:border-r-0 px-2 pt-1.5 ${
                          inTrip ? "bg-background" : "bg-muted/30"
                        }`}
                      >
                        <div
                          className={`font-inter text-[11px] ${
                            inTrip ? "text-foreground font-medium" : "text-muted-foreground/50"
                          }`}
                        >
                          {format(day, "d")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stay bars overlay */}
                <div
                  className="absolute inset-x-0 top-7 grid grid-cols-7 pointer-events-none"
                  style={{ gridAutoRows: "26px", rowGap: "2px" }}
                >
                  {slices.map((sl, idx) => {
                    const c = STAY_PALETTE[sl.seg.colorIndex];
                    const nights = differenceInCalendarDays(sl.seg.endDate, sl.seg.startDate) + 1;
                    return (
                      <button
                        key={`${sl.seg.key}-${wi}-${idx}`}
                        onClick={() => setEditing(sl.seg.items[0])}
                        className="pointer-events-auto mx-0.5 px-2 flex items-center overflow-hidden border touch-manipulation transition-opacity hover:opacity-90"
                        style={{
                          gridColumn: `${sl.colStart + 1} / span ${sl.colSpan}`,
                          gridRow: `${sl.lane + 1}`,
                          backgroundColor: c.bg,
                          color: c.text,
                          borderColor: c.border,
                          borderTopLeftRadius: sl.isStartInWeek ? 4 : 0,
                          borderBottomLeftRadius: sl.isStartInWeek ? 4 : 0,
                          borderTopRightRadius: sl.isEndInWeek ? 4 : 0,
                          borderBottomRightRadius: sl.isEndInWeek ? 4 : 0,
                          borderLeftWidth: sl.isStartInWeek ? 1 : 0,
                          borderRightWidth: sl.isEndInWeek ? 1 : 0,
                        }}
                        title={`${sl.seg.title} · ${nights} night${nights !== 1 ? "s" : ""}`}
                      >
                        <span className="font-playfair text-[11px] font-semibold truncate leading-none">
                          {sl.isStartInWeek ? sl.seg.title : `↳ ${sl.seg.title}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {segments.length > 0 && (
          <div className="shrink-0 border-t border-border px-4 py-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {segments.map((s) => {
              const c = STAY_PALETTE[s.colorIndex];
              const nights = differenceInCalendarDays(s.endDate, s.startDate) + 1;
              return (
                <div key={s.key + s.startDate.toISOString()} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm border"
                    style={{ backgroundColor: c.bg, borderColor: c.border }}
                  />
                  <span className="font-inter text-[10px] text-foreground">
                    {s.title} <span className="text-muted-foreground">· {nights}n</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <EditItemDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} item={editing} />
      )}
    </div>
  );
}
