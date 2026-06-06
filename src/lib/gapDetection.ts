import { eachDayOfInterval, parseISO, format, differenceInMinutes, addDays, differenceInCalendarDays } from "date-fns";
import type { ItineraryItem, Trip } from "@/stores/useTripStore";

export type GapSeverity = "high" | "medium" | "low";
export type GapKind = "no_stay" | "no_dining" | "free_block" | "missing_transit";

export interface Gap {
  id: string;
  date: string; // yyyy-MM-dd
  kind: GapKind;
  severity: GapSeverity;
  label: string;
  detail: string;
  /** Suggested prompt seed for the concierge. */
  prompt: string;
  /** Seed payload to one-tap create a draft itinerary item from this gap. */
  seed: {
    category: ItineraryItem["category"];
    title: string;
    location_name?: string | null;
  };
}

function toMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

/**
 * Expand multi-night stays so every covered night maps back to its stay item.
 * Mirrors MatrixGrid pill coverage (inclusive: nights = end - start + 1).
 */
function expandStayNights(items: ItineraryItem[]): Map<string, ItineraryItem[]> {
  const m = new Map<string, ItineraryItem[]>();
  for (const it of items) {
    if (it.category !== "stays" || !it.date) continue;
    const meta = (it.metadata as Record<string, unknown> | null) || {};
    const metaEnd = typeof meta.end_date === "string" ? (meta.end_date as string) : null;
    let nights = 1;
    let start: Date;
    try {
      start = parseISO(it.date);
      if (metaEnd && metaEnd >= it.date) {
        const end = parseISO(metaEnd);
        nights = Math.max(1, differenceInCalendarDays(end, start) + 1);
      }
    } catch {
      const arr = m.get(it.date) || [];
      arr.push(it);
      m.set(it.date, arr);
      continue;
    }
    for (let n = 0; n < nights; n++) {
      const iso = format(addDays(start, n), "yyyy-MM-dd");
      const arr = m.get(iso) || [];
      arr.push(it);
      m.set(iso, arr);
    }
  }
  return m;
}

/** Compute planning gaps across the trip date range. Pure — safe to memoize. */
export function detectGaps(trip: Trip | null, items: ItineraryItem[]): Gap[] {
  if (!trip?.start_date || !trip?.end_date) return [];
  let days: Date[] = [];
  try {
    days = eachDayOfInterval({
      start: parseISO(trip.start_date),
      end: parseISO(trip.end_date),
    });
  } catch {
    return [];
  }

  const gaps: Gap[] = [];
  const byDate = new Map<string, ItineraryItem[]>();
  for (const it of items) {
    if (!it.date) continue;
    if (it.category === "stays") continue; // stays handled via span expansion
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  }
  const staysByNight = expandStayNights(items);

  let prevStayCity: string | null = null;

  for (let idx = 0; idx < days.length; idx++) {
    const d = days[idx];
    const iso = format(d, "yyyy-MM-dd");
    const friendly = format(d, "EEE MMM d");
    const dayItems = byDate.get(iso) || [];
    const stays = staysByNight.get(iso) || [];
    const dining = dayItems.filter((i) => i.category === "dining");
    const logistics = dayItems.filter((i) => i.category === "logistics");
    const isLastDay = idx === days.length - 1;

    // No stay on a night (skip the final day — checkout day)
    if (!isLastDay && stays.length === 0) {
      gaps.push({
        id: `${iso}-no_stay`,
        date: iso,
        kind: "no_stay",
        severity: "high",
        label: "No accommodation",
        detail: `No stay booked for the night of ${friendly}.`,
        prompt: `Suggest 3 well-rated hotels for the night of ${friendly}.`,
        seed: { category: "stays", title: `Stay — ${friendly}` },
      });
    }

    // No dinner
    if (dining.length === 0 && (dayItems.length > 0 || stays.length > 0)) {
      gaps.push({
        id: `${iso}-no_dining`,
        date: iso,
        kind: "no_dining",
        severity: "low",
        label: "No dining planned",
        detail: `Nothing booked for meals on ${friendly}.`,
        prompt: `Suggest 3 dinner spots for ${friendly}${stays[0]?.location_name ? ` near ${stays[0].location_name}` : ""}.`,
        seed: {
          category: "dining",
          title: `Dinner — ${friendly}`,
          location_name: stays[0]?.location_name ?? null,
        },
      });
    }

    // Long unscheduled afternoon (>4h between known timed items)
    const timed = dayItems
      .map((i) => ({ s: toMin(i.start_time), e: toMin(i.end_time || i.start_time), i }))
      .filter((x) => x.s !== null)
      .sort((a, b) => (a.s! - b.s!));
    for (let i = 0; i < timed.length - 1; i++) {
      const gapMin = (timed[i + 1].s!) - (timed[i].e ?? timed[i].s!);
      if (gapMin >= 240) {
        gaps.push({
          id: `${iso}-free_block-${i}`,
          date: iso,
          kind: "free_block",
          severity: "low",
          label: `${Math.round(gapMin / 60)}h free`,
          detail: `Open block on ${friendly} between scheduled items.`,
          prompt: `Suggest 2 activities for a ${Math.round(gapMin / 60)}-hour window on ${friendly}.`,
          seed: {
            category: "activity",
            title: `Activity — ${friendly}`,
            location_name: stays[0]?.location_name ?? null,
          },
        });
      }
    }

    // Travel-day mismatch: stay city changed but no logistics
    const todayCity = stays[0]?.location_name ?? null;
    if (prevStayCity && todayCity && prevStayCity !== todayCity && logistics.length === 0) {
      gaps.push({
        id: `${iso}-missing_transit`,
        date: iso,
        kind: "missing_transit",
        severity: "medium",
        label: "Missing transit",
        detail: `Moving ${prevStayCity} → ${todayCity} on ${friendly} with no logistics booked.`,
        prompt: `Suggest transit options from ${prevStayCity} to ${todayCity} on ${friendly}.`,
        seed: {
          category: "logistics",
          title: `${prevStayCity} → ${todayCity}`,
          location_name: todayCity,
        },
      });
    }
    if (todayCity) prevStayCity = todayCity;
  }

  return gaps;
}

export function gapsByDate(gaps: Gap[]): Map<string, Gap[]> {
  const m = new Map<string, Gap[]>();
  for (const g of gaps) {
    const arr = m.get(g.date) || [];
    arr.push(g);
    m.set(g.date, arr);
  }
  return m;
}

/** 0–100. Rough heuristic: every day should have a stay (unless last) and at least 1 activity or dining. */
export function computeHealthScore(trip: Trip | null, items: ItineraryItem[]): number {
  if (!trip?.start_date || !trip?.end_date) return 0;
  let days: Date[] = [];
  try {
    days = eachDayOfInterval({
      start: parseISO(trip.start_date),
      end: parseISO(trip.end_date),
    });
  } catch {
    return 0;
  }
  if (days.length === 0) return 0;

  const byDate = new Map<string, ItineraryItem[]>();
  for (const it of items) {
    if (!it.date) continue;
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  }

  let earned = 0;
  let possible = 0;
  days.forEach((d, idx) => {
    const iso = format(d, "yyyy-MM-dd");
    const dayItems = byDate.get(iso) || [];
    const isLast = idx === days.length - 1;
    // Stay weight
    if (!isLast) {
      possible += 2;
      if (dayItems.some((i) => i.category === "stays")) earned += 2;
    }
    // Some activity/dining weight
    possible += 1;
    if (dayItems.some((i) => i.category === "activity" || i.category === "dining")) earned += 1;
  });

  return possible === 0 ? 0 : Math.round((earned / possible) * 100);
}