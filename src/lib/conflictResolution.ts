import type { ItineraryItem } from "@/stores/useTripStore";

export type ConflictFix =
  | {
      kind: "shift_time";
      itemId: string;
      newStart: string; // HH:MM
      newEnd: string;
      reason: string;
    }
  | {
      kind: "move_day";
      itemId: string;
      newDate: string; // yyyy-MM-dd
      reason: string;
    };

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function fromMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * For a conflicting pair on the same date+category, suggest shifting the
 * second item to immediately after the first finishes (or +30min buffer).
 * Returns null if no clean shift is possible (e.g. no times).
 */
export function suggestShift(
  conflictA: ItineraryItem,
  conflictB: ItineraryItem
): ConflictFix | null {
  if (!conflictA.start_time || !conflictB.start_time) return null;
  // Move the one that starts later
  const [first, second] =
    conflictA.start_time <= conflictB.start_time
      ? [conflictA, conflictB]
      : [conflictB, conflictA];

  const firstEnd = first.end_time || first.start_time!;
  const firstEndMin = toMin(firstEnd);
  const duration = second.end_time
    ? toMin(second.end_time) - toMin(second.start_time!)
    : 60;
  const newStartMin = firstEndMin + 30; // 30-min buffer
  if (newStartMin >= 24 * 60) return null;
  return {
    kind: "shift_time",
    itemId: second.id,
    newStart: fromMin(newStartMin),
    newEnd: fromMin(Math.min(24 * 60 - 1, newStartMin + Math.max(30, duration))),
    reason: `Push "${second.title}" 30 min after "${first.title}" ends.`,
  };
}

/**
 * Walk all conflicting pairs in items and return one fix per conflicting item id.
 * Caller can render an "Apply fix" affordance per item.
 */
export function suggestFixesForConflicts(items: ItineraryItem[]): ConflictFix[] {
  const byCell = new Map<string, ItineraryItem[]>();
  for (const i of items) {
    if (!i.date) continue;
    const key = `${i.date}|${i.category}`;
    const arr = byCell.get(key) || [];
    arr.push(i);
    byCell.set(key, arr);
  }
  const fixes: ConflictFix[] = [];
  const seen = new Set<string>();
  for (const group of byCell.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (!a.start_time || !b.start_time) continue;
        const aEnd = a.end_time || a.start_time;
        const bEnd = b.end_time || b.start_time;
        if (a.start_time < bEnd && b.start_time < aEnd) {
          const fix = suggestShift(a, b);
          if (fix && !seen.has(fix.itemId)) {
            fixes.push(fix);
            seen.add(fix.itemId);
          }
        }
      }
    }
  }
  return fixes;
}