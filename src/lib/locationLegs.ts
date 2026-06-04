import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { ItineraryItem, Trip } from "@/stores/useTripStore";
import { buildSegments } from "@/lib/segments";

export interface LocationLeg {
  /** Real itinerary_items.id when persisted; synthetic when derived from stays. */
  id: string;
  isGhost: boolean;
  startDate: string; // yyyy-MM-dd inclusive
  endDate: string;   // yyyy-MM-dd inclusive
  nights: number;
  city: string;
  state: string | null;
  country: string | null;
  label: string;     // city, state, country (compact)
  googlePlaceId?: string | null;
  itemRef?: ItineraryItem; // when not a ghost
}

function formatLabel(city: string, state: string | null, country: string | null) {
  return [city, state, country].filter(Boolean).join(", ");
}

/** Build legs from real itinerary "location" items.
 *  When a location row has no explicit `metadata.end_date`, derive its end
 *  from the next location's start (or the trip's end_date) so the pill
 *  spans multiple days instead of collapsing to a 1-day dot. */
export function getLegs(items: ItineraryItem[], tripEndDate?: string | null): LocationLeg[] {
  const out: LocationLeg[] = [];
  for (const it of items) {
    if (it.category !== "location" || !it.date) continue;
    const meta = (it.metadata as any) || {};
    const startDate = it.date;
    const explicitEnd: string | null = typeof meta.end_date === "string" ? meta.end_date : null;
    const endDate: string = explicitEnd || it.date; // temp — refined after sort below
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const nights = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const city: string = meta.city || it.location_name || it.title;
    const state: string | null = meta.state ?? null;
    const country: string | null = meta.country ?? null;
    out.push({
      id: it.id,
      isGhost: false,
      startDate,
      endDate,
      nights,
      city,
      state,
      country,
      label: formatLabel(city, state, country),
      googlePlaceId: it.google_place_id ?? null,
      itemRef: it,
    });
  }
  const sorted = out.sort((a, b) => a.startDate.localeCompare(b.startDate));
  // Backfill end dates from sequence for any leg that had no explicit
  // metadata.end_date (i.e. its current endDate === startDate).
  for (let i = 0; i < sorted.length; i++) {
    const leg = sorted[i];
    const meta = (leg.itemRef?.metadata as any) || {};
    const hadExplicitEnd = typeof meta.end_date === "string" && meta.end_date.length > 0;
    if (hadExplicitEnd) continue;
    const next = sorted[i + 1];
    const inferredEnd = next
      ? format(addDays(parseISO(next.startDate), -1), "yyyy-MM-dd")
      : (tripEndDate || leg.startDate);
    const finalEnd = inferredEnd < leg.startDate ? leg.startDate : inferredEnd;
    leg.endDate = finalEnd;
    leg.nights = Math.max(
      1,
      differenceInCalendarDays(parseISO(finalEnd), parseISO(leg.startDate)) + 1,
    );
  }
  return sorted;
}

/** Derive non-persisted ghost legs by collapsing consecutive same-location stays. */
export function getGhostLegsFromStays(trip: Trip, items: ItineraryItem[]): LocationLeg[] {
  if (!trip.start_date || !trip.end_date) return [];
  const segments = buildSegments(trip, items);
  return segments
    .filter((s) => !s.isUnassigned)
    .map((s) => ({
      id: `ghost-${s.id}`,
      isGhost: true,
      startDate: s.startDate,
      endDate: s.endDate,
      nights: s.nights,
      city: s.location,
      state: null,
      country: null,
      label: s.location,
    }));
}

/** True if [aStart,aEnd] overlaps [bStart,bEnd] (inclusive). */
export function legOverlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Compute pill column span: 1-based start index and width relative to trip start. */
export function legColumnSpan(tripStart: string, leg: { startDate: string; endDate: string }) {
  const ts = parseISO(tripStart);
  const startIdx = Math.max(0, differenceInCalendarDays(parseISO(leg.startDate), ts));
  const endIdx = Math.max(startIdx, differenceInCalendarDays(parseISO(leg.endDate), ts));
  return { startIdx, span: endIdx - startIdx + 1 };
}

export function addDaysIso(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

export { formatLabel as formatLegLabel };

/* ---------------- Stay pills (consecutive same-stay grouping) ---------------- */

export interface StayPill {
  id: string;            // first underlying item id (used to open edit dialog)
  itemIds: string[];     // all grouped item ids (one per night)
  startDate: string;     // yyyy-MM-dd inclusive
  endDate: string;       // yyyy-MM-dd inclusive (last night)
  nights: number;
  title: string;
  locationName: string | null;
  googlePlaceId: string | null;
  firstItem: ItineraryItem;
  /** True when the underlying row stores its own check-in/check-out via metadata.end_date. */
  isRange: boolean;
  /** Derived city label (matches a Location leg overlapping the stay). Set when `legs` is passed in. */
  derivedLocation: string | null;
}

function stayGroupKey(it: ItineraryItem): string {
  return [
    it.title?.trim().toLowerCase() ?? "",
    it.google_place_id ?? "",
    it.location_name?.trim().toLowerCase() ?? "",
  ].join("|");
}

/**
 * Build Stay pills.
 *
 * - **Range rows** (have `metadata.end_date`): emit one pill per row. The row IS the pill.
 *   New writes always use this format.
 * - **Legacy per-night rows** (no `metadata.end_date`): collapse consecutive nights
 *   sharing title + location into a single multi-night pill (backwards-compatibility).
 *
 * When `legs` is passed in, each pill's `derivedLocation` is set from whichever
 * Location leg overlaps its start date.
 */
export function getStayPills(items: ItineraryItem[], legs?: LocationLeg[]): StayPill[] {
  const stays = items
    .filter((i) => i.category === "stays" && !!i.date)
    .slice()
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const pills: StayPill[] = [];
  // Legacy fallback: track most recent pill per group key for consecutive-night merging.
  const lastLegacyByKey = new Map<string, StayPill>();

  for (const it of stays) {
    const date = it.date as string;
    const meta = (it.metadata as Record<string, unknown> | null) || {};
    const metaEnd = typeof meta.end_date === "string" ? (meta.end_date as string) : null;

    // RANGE ROW — one pill per row, never merged.
    if (metaEnd) {
      const endDate = metaEnd < date ? date : metaEnd; // clamp inverted ranges defensively
      const nights = Math.max(1, differenceInCalendarDays(parseISO(endDate), parseISO(date)) + 1);
      pills.push({
        id: it.id,
        itemIds: [it.id],
        startDate: date,
        endDate,
        nights,
        title: it.title,
        locationName: it.location_name ?? null,
        googlePlaceId: it.google_place_id ?? null,
        firstItem: it,
        isRange: true,
        derivedLocation: null,
      });
      // Don't pollute legacy merger
      continue;
    }

    // LEGACY PER-NIGHT ROW — merge consecutive same-stay rows.
    const key = stayGroupKey(it);
    const existing = lastLegacyByKey.get(key);
    const nextDay = existing
      ? format(addDays(parseISO(existing.endDate), 1), "yyyy-MM-dd")
      : null;
    if (existing && nextDay === date) {
      existing.endDate = date;
      existing.nights += 1;
      existing.itemIds.push(it.id);
      continue;
    }
    const pill: StayPill = {
      id: it.id,
      itemIds: [it.id],
      startDate: date,
      endDate: date,
      nights: 1,
      title: it.title,
      locationName: it.location_name ?? null,
      googlePlaceId: it.google_place_id ?? null,
      firstItem: it,
      isRange: false,
      derivedLocation: null,
    };
    pills.push(pill);
    lastLegacyByKey.set(key, pill);
  }

  // Derive location from overlapping Location legs (by start date).
  if (legs && legs.length > 0) {
    for (const p of pills) {
      const leg = legs.find((l) => p.startDate >= l.startDate && p.startDate <= l.endDate);
      p.derivedLocation = leg ? leg.city : null;
    }
  }

  return pills;
}

/** Greedy lane assignment so overlapping pills stack vertically. Returns max lane index. */
export function assignLanes<T extends { startDate: string; endDate: string }>(
  pills: T[],
): { pill: T; lane: number }[] {
  const sorted = pills.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const laneEnds: string[] = []; // endDate per lane
  const out: { pill: T; lane: number }[] = [];
  for (const p of sorted) {
    let lane = laneEnds.findIndex((end) => end < p.startDate);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p.endDate);
    } else {
      laneEnds[lane] = p.endDate;
    }
    out.push({ pill: p, lane });
  }
  return out;
}