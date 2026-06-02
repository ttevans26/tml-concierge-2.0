import type { ItineraryItem } from "@/stores/useTripStore";
import type { ExtractedItem } from "@/components/workspace/SmartPullTray";

export type DiffStatus = "new" | "duplicate" | "conflict";

export interface DiffResult {
  status: DiffStatus;
  match?: ItineraryItem;
  reason?: string;
}

function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function timesOverlap(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null,
): boolean {
  if (!aStart || !bStart) return false;
  const aE = aEnd || aStart;
  const bE = bEnd || bStart;
  return aStart < bE && bStart < aE;
}

/** Diff a single extracted item against the existing itinerary. */
export function diffItem(extracted: ExtractedItem, existing: ItineraryItem[]): DiffResult {
  // 1. Strongest signal: confirmation code match
  if (extracted.confirmation_code) {
    const code = norm(extracted.confirmation_code);
    const match = existing.find((i) => norm(i.confirmation_code) === code);
    if (match) return { status: "duplicate", match, reason: "Same confirmation code" };
  }

  // 2. Flight number + date match
  if (extracted.flight_number && extracted.date) {
    const fn = norm(extracted.flight_number);
    const match = existing.find(
      (i) =>
        i.date === extracted.date &&
        norm((i.api_metadata as Record<string, unknown>)?.flight_number as string) === fn,
    );
    if (match) return { status: "duplicate", match, reason: "Same flight on same date" };
  }

  // 3. Title + date match (same category)
  if (extracted.title && extracted.date) {
    const t = norm(extracted.title);
    const match = existing.find(
      (i) => i.date === extracted.date && i.category === extracted.category && norm(i.title) === t,
    );
    if (match) return { status: "duplicate", match, reason: "Same title on same date" };
  }

  // 4. Time conflict on same date+category
  if (extracted.date && extracted.start_time) {
    const match = existing.find(
      (i) =>
        i.date === extracted.date &&
        i.category === extracted.category &&
        timesOverlap(extracted.start_time, extracted.end_time, i.start_time, i.end_time),
    );
    if (match) return { status: "conflict", match, reason: `Overlaps "${match.title}"` };
  }

  return { status: "new" };
}

/** Split a batched paste on `---` lines into separate email chunks. */
export function splitBatch(text: string): string[] {
  return text
    .split(/\n\s*---+\s*\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10);
}