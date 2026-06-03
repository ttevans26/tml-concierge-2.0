# Reshuffle Locations: delete bands + dedupe duplicate cities

Two issues to fix in the Reshuffle Locations popover.

## 1. Duplicate location bands (e.g. two "Paris" rows)

**Root cause** — `src/lib/segments.ts` `buildSegments()` groups consecutive nights by label, but when a Stay has no `location_name` it falls back to the Stay's `title` (hotel name). Two different Paris hotels back-to-back therefore produce two segments labeled by hotel, not one "Paris" band.

```ts
// current
const label = (s.location_name?.trim() || s.title.trim()) || "Stay";
```

**Fix** — prefer `location_name` (city/state/country) as the only grouping key. When it's missing, mark that night as `null` (unassigned-style) so it merges with adjacent unnamed nights and the user is prompted to "Set city, state, country" in the Reshuffle row, which already cascades the name to every stay in the window.

This collapses the duplicate Paris bands into one and keeps the Matrix Grid + Reshuffle list in sync (both already read from segments / legs derived this way).

Side-effect to verify: the Matrix Grid leg label for orphan-stay nights will now show as "Set location" until named — acceptable because the new inline rename in the Reshuffle row writes it back to all stays in the window.

## 2. Delete a location band

Add a small trash icon button on each `ReshuffleRow` (next to the up/down arrows, hidden for unassigned rows).

**Behavior** when clicked:
1. Confirm via `AlertDialog` ("Remove {label} and its {N} nights? Stays, dining and activities in this window will be deleted.").
2. Remove the segment from local `order` state in `ReshuffleLegsList`.
3. On Apply, in addition to existing `computeReorderPatches`, delete every `itemIds` belonging to removed segments via `useTripStore.deleteItineraryItem`, and shrink `trip.end_date` by the removed nights using `updateTrip`.
4. Trip start_date unchanged; subsequent segments shift earlier automatically because they're re-laid out from `trip.start_date` using their preserved night counts.

If the user removes every assigned segment, disable Apply with a tooltip ("A trip needs at least one location").

## Files to touch

- `src/lib/segments.ts` — change `dayLabels[offset]` to only use `location_name`; drop the title fallback.
- `src/components/workspace/ReshuffleLegsList.tsx` — add `removedIds` state, trash button + confirm dialog per row, extend `handleApply` to delete items and patch `trip.end_date`.
- `src/components/workspace/MatrixGrid.tsx` — pass `updateTrip` / `deleteItineraryItem` callbacks through `onApply` if needed (or call store directly inside the list, matching the existing `updateItineraryItem` pattern).

## Out of scope

- Logistics rows, budget recomputation triggers (Splurge Engine already reacts to store changes).
- Editing nights inline (separate request).
