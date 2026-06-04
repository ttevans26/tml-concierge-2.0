## Root cause

Your trip has **7 `location` rows and 0 `stays` rows** in the database. The Matrix Grid renders Locations correctly because `getLegs()` reads from `category='location'` items. **Reshuffle and the segment banners read from `buildSegments()` in `src/lib/segments.ts`, which only looks at `category='stays'`.**

Result: every day is "unassigned" → only one synthetic segment is produced → Reshuffle bails out with *"Add stays in at least two locations to reshuffle the trip."* and the SegmentCard list renders empty banners. The Matrix Grid (7 location pills) and Reshuffle (zero usable segments) are reading from two different sources.

This is a regression from the Stays refactor — Stays are now optional/range-based, but the trip-structure logic was never re-pointed at Locations.

## Fix

Repoint `buildSegments` (and anything downstream) at **Location items** as the primary source of truth, with stays-derived fallback only when no locations exist.

### `src/lib/segments.ts` — `buildSegments(trip, items)`

1. Scan `items` for `category === 'location'` rows with a `date`. Each row uses `date` as the start and `metadata.end_date` (or `date` itself) as the inclusive end. Clamp each range to `[trip.start_date, trip.end_date]`. Sort by start.
2. If 1+ location rows exist:
   - Emit one `LocationSegment` per location row using `location_name` (fallback to `title`) as the label.
   - For any gap between consecutive locations, or before the first / after the last, emit an `isUnassigned` segment for the empty days inside the trip window.
   - Skip the existing "anchored by stays" path entirely.
3. If **no** location rows exist, keep today's stays-anchored behavior unchanged (backwards-compat for trips planned the old way).
4. After segments are built, assign every item (any category) whose `date` falls inside a segment window to that segment's `itemIds`/`counts`, exactly as today.
5. Drop the post-pass "merge adjacent stays with the same `location_name`" step when on the location path — locations are already the source of truth and shouldn't be merged.

### `src/components/workspace/ReshuffleLegsList.tsx`

- No structural changes needed. With real segments now flowing in, the existing DnD list, preview math, and `computeReorderPatches` will work.
- The `legForSegment` lookup already matches by date overlap, so each segment will resolve to its corresponding Matrix-Grid leg and the rename/cascade flow keeps working.
- The "at least two locations" guard (`baseSegments.length < 2`) stays — but it will now correctly count your 7 locations instead of 1 synthetic block.

### `src/components/workspace/OrphanItemsBanner.tsx`

- No change. `findOrphanedItems` already uses the trip's date window, not segments. (Your current trip window covers all 7 locations, so this banner should disappear once segments populate.)

### Out of scope

- No DB schema changes.
- No changes to Stays data model — the previous refactor stands.
- No visual / coloring changes to the Matrix Grid (it already reads Locations).
- No new auto-creation of Location rows from Stays.

## Files

- `src/lib/segments.ts` — rewrite `buildSegments` to prefer Location items; keep stays fallback.
- (Verify only, no edits expected) `src/components/workspace/ReshuffleLegsList.tsx`, `OrphanItemsBanner.tsx`, `SegmentCard.tsx`.

## Verification after build

1. Open `/trip/affb0049-…` → Reshuffle panel shows 7 draggable rows (Paris → Sherborne).
2. Drag a row, confirm preview dates shift, Apply persists.
3. Matrix Grid Location band continues to render the same 7 pills (coloring/labels unchanged).
4. Orphan banner does not appear (all items fall inside Aug 14 – Sep 10).
