import { eachDayOfInterval, parseISO, format, addDays, differenceInCalendarDays } from "date-fns";
import type { ItineraryItem, Trip } from "@/stores/useTripStore";

export type GapSeverity = "high" | "medium" | "low";
export type GapKind = "no_stay" | "stay_gap" | "missing_transit";

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

  // Pre-compute the next planned stay city for each day index (for stay_gap labeling).
  const dayIsos = days.map((d) => format(d, "yyyy-MM-dd"));
  const nextStayCityFrom: (string | null)[] = new Array(dayIsos.length).fill(null);
  {
    let next: string | null = null;
    for (let i = dayIsos.length - 1; i >= 0; i--) {
      const here = staysByNight.get(dayIsos[i])?.[0]?.location_name ?? null;
      if (here) next = here;
      nextStayCityFrom[i] = next;
    }
  }

  let prevStayCity: string | null = null;

  for (let idx = 0; idx < days.length; idx++) {
    const d = days[idx];
    const iso = format(d, "yyyy-MM-dd");
    const friendly = format(d, "EEE MMM d");
    const dayItems = byDate.get(iso) || [];
    const stays = staysByNight.get(iso) || [];
    const logistics = dayItems.filter((i) => i.category === "logistics");
    const isLastDay = idx === days.length - 1;

    // No stay on a night (skip the final day — checkout day).
    // Classify as `stay_gap` if there's a previous stay and an upcoming stay in a different city
    // (orphan night between two segments) — otherwise plain `no_stay`.
    if (!isLastDay && stays.length === 0) {
      const nextCity = nextStayCityFrom[idx];
      const isOrphanBetweenSegments =
        prevStayCity && nextCity && prevStayCity !== nextCity;
      if (isOrphanBetweenSegments) {
        gaps.push({
          id: `${iso}-stay_gap`,
          date: iso,
          kind: "stay_gap",
          severity: "high",
          label: "Stay gap",
          detail: `Gap between ${prevStayCity} and ${nextCity} — no stay on ${friendly}.`,
          prompt: `Suggest a stay for the night of ${friendly} bridging ${prevStayCity} and ${nextCity}.`,
          seed: {
            category: "stays",
            title: `Stay — ${friendly}`,
            location_name: nextCity,
          },
        });
      } else {
        gaps.push({
          id: `${iso}-no_stay`,
          date: iso,
          kind: "no_stay",
          severity: "high",
          label: "No accommodation",
          detail: `No stay booked for the night of ${friendly}.`,
          prompt: `Suggest 3 well-rated hotels for the night of ${friendly}${nextCity ? ` near ${nextCity}` : ""}.`,
          seed: {
            category: "stays",
            title: `Stay — ${friendly}`,
            location_name: nextCity,
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

/** 0–100. Critical-only: percentage of nights (excluding checkout day) with accommodation booked. */
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

  let earned = 0;
  let possible = 0;
  const staysByNight = expandStayNights(items);
  days.forEach((d, idx) => {
    const iso = format(d, "yyyy-MM-dd");
    const isLast = idx === days.length - 1;
    if (isLast) return;
    possible += 1;
    if ((staysByNight.get(iso) || []).length > 0) earned += 1;
  });

  return possible === 0 ? 0 : Math.round((earned / possible) * 100);
}