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

/** Build legs from real itinerary "location" items. */
export function getLegs(items: ItineraryItem[]): LocationLeg[] {
  const out: LocationLeg[] = [];
  for (const it of items) {
    if (it.category !== "location" || !it.date) continue;
    const meta = (it.metadata as any) || {};
    const startDate = it.date;
    const endDate: string = meta.end_date || it.date;
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
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
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
}

function stayGroupKey(it: ItineraryItem): string {
  return [
    it.title?.trim().toLowerCase() ?? "",
    it.google_place_id ?? "",
    it.location_name?.trim().toLowerCase() ?? "",
  ].join("|");
}

/**
 * Collapse per-night stay items into spanning pills.
 * Stays sharing title + location are merged when their dates are consecutive.
 */
export function getStayPills(items: ItineraryItem[]): StayPill[] {
  const stays = items
    .filter((i) => i.category === "stays" && !!i.date)
    .slice()
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const pills: StayPill[] = [];
  const byKey = new Map<string, StayPill>();

  for (const it of stays) {
    const key = stayGroupKey(it);
    const existing = byKey.get(key);
    const date = it.date as string;
    // Consecutive if date == endDate + 1
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
    };
    pills.push(pill);
    byKey.set(key, pill);
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