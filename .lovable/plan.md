# Trip Editor — Dates & Location Segments

Add a single "Edit Trip" surface that lets you (a) change the trip's date window and (b) reorder location segments by drag-and-drop. Existing `TripSettingsModal` stays focused on budget/currency; the new editor opens from the same Settings menu as a dedicated tab.

## 1. Entry point

In the workspace header, replace the single **Settings** button with a small dropdown:
- **Edit Trip…** → opens `EditTripDialog` (new)
- **Trip Settings…** → existing budget/currency modal

`EditTripDialog` is a tabbed Dialog with two tabs: **Dates** and **Itinerary Segments**.

## 2. Dates tab

Three controls, all operating on `trips.start_date` / `trips.end_date`:

1. **Start date** picker (Shadcn Calendar in Popover, `pointer-events-auto`)
2. **End date** picker
3. **Shift entire trip** — number input `±N days` + "Apply shift" button. Adds N to both start and end and to every item's `date`.

Live preview strip shows: `Aug 21 → Sep 17, 2026  ·  28 nights` updating to the proposed dates with a diff badge (`+3 days at end`, `-2 days at start`, `shifted +7 days`).

**Soft-orphan rule (per your answer):** if the new window excludes existing items, they are kept in the DB but their `date` falls outside `[start_date, end_date]`. A persistent banner appears in the workspace ("3 items outside trip window — Review") that opens an **Orphaned Items tray** (new small Sheet) listing each orphan with two actions: "Move to <nearest valid day>" or "Delete".

Extending dates simply widens the Matrix — empty new day columns appear automatically (Matrix already renders by `eachDayOfInterval(start, end)`).

Save = single `updateTrip` call. If a shift is applied, also bulk-update affected `itinerary_items.date` (one RPC-style batch update grouped by trip).

## 3. Itinerary Segments tab

**Segment definition (per your answer): by Stay items.** Algorithm runs client-side over `itinerary_items` where `category = 'stay'`:

1. Sort stays by `date`.
2. Each stay spans `date` … `date + nights - 1` (uses existing Stay Mapping Logic).
3. Group consecutive stays sharing the same `location_name` (case-insensitive) into one **Segment**: `{ location_name, startDate, endDate, stayIds[], itemIds[] }`.
4. `itemIds` = all `itinerary_items` (any category) whose `date` falls in `[startDate, endDate]`.
5. Days with no Stay become a synthetic "Unassigned" segment so nothing is lost.

UI: vertical list of segment cards (DnD-kit sortable). Each card shows:
- Location name (e.g. "London, UK")
- Date range + night count
- Item count by category (chips)
- Drag handle (left), kebab menu (right) with **Move to start**, **Move to end**, **Detach day(s)**

**Drag-and-drop:** install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Vertical sortable list; same library is already a candidate for the Studio→Matrix bridge so it's reusable.

**Reorder math:** when segments are reordered, recompute each segment's new `startDate` by walking the trip from `trips.start_date`, allocating each segment its original night-count consecutively. Then for every item in the segment, `newDate = trip.start_date + (segmentOffset + itemDayWithinSegment)`. Times, costs, and all other fields untouched.

Preview row at top: `Old: London → Paris → Rome` ⟶ `New: Paris → Rome → London`. **Apply Reorder** triggers a batched `update` on `itinerary_items.date` for affected items (single Supabase call using `upsert` array of `{id, date}`), wrapped in optimistic Zustand updates with rollback on error.

## 4. Data & store

- No schema changes. `trips.start_date/end_date` and `itinerary_items.date` already exist.
- `useTripStore` additions:
  - `shiftTripDates(deltaDays: number)` — updates trip + all items.
  - `reorderSegments(newOrder: Segment[])` — bulk update item dates.
  - `getOrphanedItems()` — derived selector for items outside `[start_date, end_date]`.
- All writes go through existing `supabase.from(...).update(...)`; RLS already restricts to owner.

## 5. Orphan banner

Mount a small `OrphanItemsBanner` inside `WorkspaceLayout` above the Matrix. Visible only when `getOrphanedItems().length > 0`. Click opens the orphan Sheet.

## 6. Files

**New**
- `src/components/workspace/EditTripDialog.tsx` (tabs + dates form + segments list)
- `src/components/workspace/SegmentCard.tsx` (sortable DnD item)
- `src/components/workspace/OrphanItemsBanner.tsx`
- `src/components/workspace/OrphanItemsSheet.tsx`
- `src/lib/segments.ts` (pure helpers: `buildSegments`, `reorderSegmentsToDates`)

**Edited**
- `src/stores/useTripStore.ts` — add `shiftTripDates`, `reorderSegments`, orphan selector.
- `src/components/workspace/WorkspaceLayout.tsx` (or header component) — Settings dropdown + banner mount.
- `src/components/workspace/TripSettingsModal.tsx` — keep as-is, just relabeled "Trip Settings" in the dropdown.
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- `mem://index.md` + new `mem://features/trip-editor` entry.

## 7. Out of scope

- Editing per-item dates/times (already handled in Smart Card edit).
- Auto-suggesting new segment order (no AI here — purely user-driven).
- Multi-trip merging or copying segments between trips.
- Conflict detection beyond what Matrix Logic already does on save.
