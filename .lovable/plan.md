## Goal
Color calendar stay pills by their **derived Location leg (city)**, and guarantee that two pills which sit adjacent in time never share a color — fixing the current "Hilton → Marriott → Hilton" same-color run.

## Approach

Two-step assignment in `CalendarStaysView.tsx`:

1. **Group key = city (derived leg).**
   - Primary key: `pill.derivedLocation` (already set by `getStayPills(items, legs)`).
   - Fallback chain when a leg overlap isn't found: `pill.locationName` → `"unassigned"`.
   - All pills in the same city group must share the same palette slot.

2. **Assign palette slots in chronological order, with adjacency avoidance.**
   - Sort pills by `startDate`.
   - Walk the list; for each new city group, pick the next palette index that
     - hasn't been used by the immediately previous group, **and**
     - hasn't been used by any pill whose `endDate + 1 day == this pill.startDate` (handles same-day check-out/check-in transitions).
   - Once a city has been assigned a slot, reuse it for every subsequent pill in that city (so "Paris" stays one color across the trip).
   - If the palette runs out before satisfying constraints, fall back to a hash so we never crash.

3. **Palette stays the same `STAY_PALETTE` (8 muted Quiet-Luxury tones).** No new tokens.

## Files

- `src/components/workspace/CalendarStaysView.tsx`
  - Replace the current `hashIndex(title|locationName)` mapping with a memoized `Map<pillId, paletteIndex>` built via the algorithm above.
  - Helper lives inline (small, view-specific). No changes to `locationLegs.ts` or `StayDialog`.
  - Mobile agenda list, desktop bars, and the legend all read from the same map → consistent colors everywhere.
  - Legend gets a small subtitle showing the city (derivedLocation) under the pill title so the color → city link is obvious.

## Out of scope
- No data model changes, no shared util changes, no Matrix Grid recoloring.
- No country detection.

## Verification
1. Trip with Paris (3 nights) → Rome (4 nights) → Paris (2 nights): both Paris pills are the same color; Rome is a different color; the Paris→Rome and Rome→Paris transitions never repeat the prior color.
2. Two back-to-back hotels in the same city show one shared color (intentional — same leg).
3. A stay with no matching leg falls into an "unassigned" group and still gets a non-adjacent color.
4. Legend lists each pill with the correct swatch + city subtitle.
