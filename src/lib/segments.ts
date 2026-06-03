import { parseISO, format, differenceInCalendarDays, addDays } from "date-fns";
import type { ItineraryItem, Trip } from "@/stores/useTripStore";

export interface LocationSegment {
  /** Stable id derived from location name + index, for DnD keys */
  id: string;
  /** Normalised location label shown to the user */
  location: string;
  /** True when the segment is synthetic (no Stay anchors it) */
  isUnassigned: boolean;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd (inclusive last night/day)
  nights: number;    // endDate - startDate + 1
  /** All itinerary items whose date falls in [startDate, endDate] */
  itemIds: string[];
  /** Count by category for the segment summary chips */
  counts: Record<string, number>;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase();

/**
 * Build location segments from itinerary items.
 *
 * Anchored by Stay items (one row per night). Consecutive nights sharing the
 * same `location_name` (case-insensitive) collapse into one segment. Any day
 * in the trip window without a Stay becomes part of an "Unassigned" segment
 * spanning contiguous orphan days.
 */
export function buildSegments(trip: Trip, items: ItineraryItem[]): LocationSegment[] {
  if (!trip.start_date || !trip.end_date) return [];
  const ts = parseISO(trip.start_date);
  const te = parseISO(trip.end_date);
  const totalDays = differenceInCalendarDays(te, ts) + 1;
  if (totalDays <= 0) return [];

  // For each day in the trip window, find the Stay location (if any).
  const stays = items.filter((i) => i.category === "stays" && i.date);
  const dayLabels: (string | null)[] = new Array(totalDays).fill(null);
  for (const s of stays) {
    const offset = differenceInCalendarDays(parseISO(s.date!), ts);
    if (offset >= 0 && offset < totalDays) {
      // Prefer location_name (city). Fall back to title so stays without a
      // city still show as their own segment — the Reshuffle row's inline
      // rename cascades a city name to every stay in the merged window.
      const label = (s.location_name?.trim() || s.title?.trim()) || "Stay";
      dayLabels[offset] = label;
    }
  }

  // Collapse consecutive equal labels into runs.
  const segments: LocationSegment[] = [];
  let i = 0;
  let synthIdx = 0;
  while (i < totalDays) {
    const label = dayLabels[i];
    let j = i;
    while (j < totalDays && norm(dayLabels[j]) === norm(label)) j++;
    const startDate = format(addDays(ts, i), "yyyy-MM-dd");
    const endDate = format(addDays(ts, j - 1), "yyyy-MM-dd");
    const nights = j - i;
    const isUnassigned = label === null;
    const idLabel = isUnassigned ? `__unassigned_${synthIdx++}` : norm(label!);
    segments.push({
      id: `${idLabel}|${startDate}`,
      location: isUnassigned ? "Unassigned days" : label!,
      isUnassigned,
      startDate,
      endDate,
      nights,
      itemIds: [],
      counts: {},
    });
    i = j;
  }

  // Assign every item that falls inside a segment window to that segment.
  for (const it of items) {
    if (!it.date) continue;
    for (const seg of segments) {
      if (it.date >= seg.startDate && it.date <= seg.endDate) {
        seg.itemIds.push(it.id);
        seg.counts[it.category] = (seg.counts[it.category] ?? 0) + 1;
        break;
      }
    }
  }

  // Post-pass: merge adjacent assigned segments whose stays share the same
  // location_name (case-insensitive). Collapses duplicates like two distinct
  // Paris hotels back-to-back into a single "Paris" band.
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const locOf = (seg: LocationSegment): string | null => {
    for (const id of seg.itemIds) {
      const it = itemsById.get(id);
      if (it?.category === "stays" && it.location_name?.trim()) {
        return norm(it.location_name);
      }
    }
    return null;
  };
  const merged: LocationSegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      !prev.isUnassigned &&
      !seg.isUnassigned &&
      locOf(prev) &&
      locOf(prev) === locOf(seg)
    ) {
      prev.endDate = seg.endDate;
      prev.nights += seg.nights;
      prev.itemIds.push(...seg.itemIds);
      for (const [k, v] of Object.entries(seg.counts)) {
        prev.counts[k] = (prev.counts[k] ?? 0) + v;
      }
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

/**
 * Given a new ordering of segments, produce a flat array of
 * `{ id, date }` patches for every item that needs to move.
 *
 * Each segment keeps its night-count; we concatenate segments back-to-back
 * starting at `trip.start_date`. Each item's offset within its old segment is
 * preserved (so an item on day 2 of a 3-night London stay lands on day 2 of
 * the new London window).
 */
export function computeReorderPatches(
  trip: Trip,
  newOrder: LocationSegment[],
  items: ItineraryItem[],
): { id: string; date: string }[] {
  if (!trip.start_date) return [];
  const tripStart = parseISO(trip.start_date);
  const byId = new Map(items.map((i) => [i.id, i]));
  const patches: { id: string; date: string }[] = [];
  let cursor = 0;
  for (const seg of newOrder) {
    const oldStart = parseISO(seg.startDate);
    for (const itemId of seg.itemIds) {
      const it = byId.get(itemId);
      if (!it || !it.date) continue;
      const offsetWithin = differenceInCalendarDays(parseISO(it.date), oldStart);
      const newDate = format(addDays(tripStart, cursor + offsetWithin), "yyyy-MM-dd");
      if (newDate !== it.date) patches.push({ id: it.id, date: newDate });
    }
    cursor += seg.nights;
  }
  return patches;
}

/**
 * Items whose date is outside the trip's [start_date, end_date] window
 * (or whose date is null). These show in the OrphanItemsBanner.
 */
export function findOrphanedItems(trip: Trip | null, items: ItineraryItem[]): ItineraryItem[] {
  if (!trip || !trip.start_date || !trip.end_date) return [];
  return items.filter((i) => {
    if (!i.date) return false;
    return i.date < trip.start_date! || i.date > trip.end_date!;
  });
}

/** Nearest in-window date for an orphan (clamps to start/end). */
export function clampDateToTrip(trip: Trip, date: string): string {
  if (!trip.start_date || !trip.end_date) return date;
  if (date < trip.start_date) return trip.start_date;
  if (date > trip.end_date) return trip.end_date;
  return date;
}

/** Shift every item date by deltaDays. Returns patch array. */
export function computeShiftPatches(
  items: ItineraryItem[],
  deltaDays: number,
): { id: string; date: string }[] {
  if (deltaDays === 0) return [];
  return items
    .filter((i) => i.date)
    .map((i) => ({
      id: i.id,
      date: format(addDays(parseISO(i.date!), deltaDays), "yyyy-MM-dd"),
    }));
}