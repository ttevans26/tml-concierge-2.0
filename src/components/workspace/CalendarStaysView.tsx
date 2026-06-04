import { useMemo, useState } from "react";
import {
  parseISO,
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  differenceInCalendarDays,
  addDays,
  isWithinInterval,
} from "date-fns";
import { useTripStore } from "@/stores/useTripStore";
import {
  getLegs,
  getStayPills,
  assignLanes as assignPillLanes,
  type StayPill,
} from "@/lib/locationLegs";
import StayDialog from "./StayDialog";

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

/**
 * Calendar uses the same canonical Stay primitives as the Matrix Grid:
 *   getLegs(items) → derived Location legs (for derivedLocation labels)
 *   getStayPills(items, legs) → handles both range rows (metadata.end_date)
 *     and legacy per-night rows (merged by title+place+location)
 *   assignLanes(pills) → greedy lane stacking
 *
 * Edits open StayDialog (shared with Matrix), not EditItemDialog, so all
 * stay writes flow through one persistence path.
 *
 * TODO: drag-to-move / drag-to-resize on calendar pills (currently click-to-edit).
 */
interface PillSlice {
  pill: StayPill;
  startDate: string; // yyyy-MM-dd, clamped to week
  endDate: string;   // yyyy-MM-dd, clamped to week
  colStart: number;  // 0..6
  colSpan: number;
  isStartInWeek: boolean;
  isEndInWeek: boolean;
  colorIndex: number;
}

/* ---------- Component ---------- */
export default function CalendarStaysView() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const itineraryItems = useTripStore((s) => s.itineraryItems);
  const [stayEdit, setStayEdit] = useState<{ open: boolean; pill: StayPill | null }>({
    open: false,
    pill: null,
  });

  const legs = useMemo(() => getLegs(itineraryItems), [itineraryItems]);
  const pills = useMemo(
    () => getStayPills(itineraryItems, legs),
    [itineraryItems, legs],
  );

  /**
   * Color pills by city (derived Location leg). Same city → same color across
   * the trip. Chronological walk picks the next palette slot that does NOT
   * match the previous group or any pill whose endDate+1 == this pill.startDate
   * (back-to-back transitions), so contiguous bands never share a color.
   */
  const cityKey = (p: StayPill): string =>
    (p.derivedLocation || p.locationName || "__unassigned").trim().toLowerCase();

  const colorByPillId = useMemo(() => {
    const sorted = pills.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
    const cityToSlot = new Map<string, number>();
    const result = new Map<string, number>(); // pillId → palette index
    let prevCityKey: string | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const key = cityKey(p);
      let slot = cityToSlot.get(key);
      if (slot === undefined) {
        // Collect forbidden slots: previous group + any pill adjacent in time.
        const forbidden = new Set<number>();
        if (prevCityKey && cityToSlot.has(prevCityKey)) {
          forbidden.add(cityToSlot.get(prevCityKey)!);
        }
        for (let j = 0; j < i; j++) {
          const other = sorted[j];
          const otherKey = cityKey(other);
          if (otherKey === key) continue;
          // adjacency: other ends the day before p starts, or ranges overlap/touch
          const otherEndPlus1 = format(addDays(parseISO(other.endDate), 1), "yyyy-MM-dd");
          if (otherEndPlus1 >= p.startDate && other.startDate <= p.endDate) {
            const s = cityToSlot.get(otherKey);
            if (s !== undefined) forbidden.add(s);
          }
        }
        // Pick first palette slot not in forbidden; round-robin from cityToSlot.size.
        const start = cityToSlot.size % STAY_PALETTE.length;
        slot = start;
        for (let k = 0; k < STAY_PALETTE.length; k++) {
          const candidate = (start + k) % STAY_PALETTE.length;
          if (!forbidden.has(candidate)) {
            slot = candidate;
            break;
          }
        }
        cityToSlot.set(key, slot);
      }
      result.set(p.id, slot);
      prevCityKey = key;
    }
    return result;
  }, [pills]);

  const colorFor = (pill: StayPill) =>
    STAY_PALETTE[colorByPillId.get(pill.id) ?? hashIndex(pill.id, STAY_PALETTE.length)];

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

  /* Per-week pill slices (clamp pill dates to the week, compute grid columns) */
  const slicesForWeek = (week: Date[]): PillSlice[] => {
    const wkStartIso = format(week[0], "yyyy-MM-dd");
    const wkEndIso = format(week[6], "yyyy-MM-dd");
    return pills
      .filter((p) => p.startDate <= wkEndIso && p.endDate >= wkStartIso)
      .map<PillSlice>((p) => {
        const sliceStart = p.startDate < wkStartIso ? wkStartIso : p.startDate;
        const sliceEnd = p.endDate > wkEndIso ? wkEndIso : p.endDate;
        const colStart = differenceInCalendarDays(parseISO(sliceStart), week[0]);
        const colSpan =
          differenceInCalendarDays(parseISO(sliceEnd), parseISO(sliceStart)) + 1;
        return {
          pill: p,
          startDate: sliceStart,
          endDate: sliceEnd,
          colStart,
          colSpan,
          isStartInWeek: sliceStart === p.startDate,
          isEndInWeek: sliceEnd === p.endDate,
          colorIndex:
            colorByPillId.get(p.id) ?? hashIndex(p.id, STAY_PALETTE.length),
        };
      });
  };

  const isInTrip = (d: Date) =>
    isWithinInterval(d, { start: tripStart, end: tripEnd });

  const dayOfWeekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const openPill = (pill: StayPill) => setStayEdit({ open: true, pill });

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Trip date subtitle */}
      <div className="shrink-0 border-b border-border px-4 py-2">
        <p className="font-inter text-[11px] text-muted-foreground">
          {format(tripStart, "MMM d")} — {format(tripEnd, "MMM d, yyyy")} · {pills.length} stay{pills.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Mobile: agenda list */}
      <div className="flex-1 overflow-y-auto sm:hidden p-3 space-y-2">
        {pills.length === 0 && (
          <p className="text-center font-inter text-xs text-muted-foreground py-8">
            No stays added yet. Add a stay in the Matrix view to see it here.
          </p>
        )}
        {pills.map((p) => {
          const c = colorFor(p);
          const subtitle = p.derivedLocation || p.locationName;
          return (
            <button
              key={p.id}
              onClick={() => openPill(p)}
              className="w-full text-left rounded-sm px-3 py-2.5 border min-h-[44px] touch-manipulation transition-opacity hover:opacity-90"
              style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
            >
              <div className="font-playfair text-sm font-semibold leading-tight">{p.title}</div>
              {subtitle && (
                <div className="font-inter text-[10px] mt-0.5 opacity-80">{subtitle}</div>
              )}
              <div className="font-inter text-[10px] mt-0.5 opacity-90">
                {format(parseISO(p.startDate), "EEE, MMM d")} → {format(addDays(parseISO(p.endDate), 1), "EEE, MMM d")} · {p.nights} night{p.nights !== 1 ? "s" : ""}
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
            const slices = slicesForWeek(week);
            const laned = assignPillLanes(slices); // [{ pill: PillSlice, lane }]
            const laneCount = Math.max(1, ...laned.map((s) => s.lane + 1));
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
                  {laned.map(({ pill: sl, lane }, idx) => {
                    const c = STAY_PALETTE[sl.colorIndex];
                    return (
                      <button
                        key={`${sl.pill.id}-${wi}-${idx}`}
                        onClick={() => openPill(sl.pill)}
                        className="pointer-events-auto mx-0.5 px-2 flex items-center overflow-hidden border touch-manipulation transition-opacity hover:opacity-90"
                        style={{
                          gridColumn: `${sl.colStart + 1} / span ${sl.colSpan}`,
                          gridRow: `${lane + 1}`,
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
                        title={`${sl.pill.title} · ${sl.pill.nights} night${sl.pill.nights !== 1 ? "s" : ""}`}
                      >
                        <span className="font-playfair text-[11px] font-semibold truncate leading-none">
                          {sl.isStartInWeek ? sl.pill.title : `↳ ${sl.pill.title}`}
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
        {pills.length > 0 && (
          <div className="shrink-0 border-t border-border px-4 py-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {pills.map((p) => {
              const c = colorFor(p);
              return (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm border"
                    style={{ backgroundColor: c.bg, borderColor: c.border }}
                  />
                  <span className="font-inter text-[10px] text-foreground">
                    {p.title} <span className="text-muted-foreground">· {p.nights}n</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {stayEdit.open && stayEdit.pill && activeTrip.start_date && activeTrip.end_date && (
        <StayDialog
          mode="edit"
          open={stayEdit.open}
          onOpenChange={(open) => setStayEdit((s) => ({ ...s, open }))}
          tripId={activeTrip.id}
          pill={stayEdit.pill}
          tripStart={activeTrip.start_date}
          tripEnd={activeTrip.end_date}
          legs={legs}
        />
      )}
    </div>
  );
}
