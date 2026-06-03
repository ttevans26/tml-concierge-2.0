# Trip date shift, leg reorder, and rainbow location columns

Three changes to make the Matrix Grid easier to reshuffle and read.

## 1. Inline start-date edit (shift whole trip)

Today, shifting the trip is buried in the "Edit Trip" dialog → Dates tab → "Shift entire trip" field. Make it one click from the grid.

- Above the matrix date-header row (next to the existing "Drag, scroll, or use arrows to pan" caption), add a compact label like **`Trip starts: Aug 20, 2026 ▾`**.
- Clicking it opens a small popover with a calendar.
- Picking a new date computes `delta = newStart - currentStart` and calls the existing `shiftTripDates(tripId, delta)` in `useTripStore`. This already shifts both trip dates AND every itinerary item by N days, so the whole trip (UK leg included) moves with it.
- Toast: `Trip shifted +/-N days`.

No store/DB changes — `shiftTripDates` already does exactly this.

## 2. Drag location-leg pills on the grid

Today legs can be reordered only inside Edit Trip → Itinerary Segments. Add the same capability directly on the Location row pills.

- Make each leg pill in the Location-row overlay (`displayedLegs.map(...)` in `MatrixGrid.tsx`) draggable horizontally with `@dnd-kit` (already in the project).
- Drag interaction:
  - Grabbing a confirmed leg pill (ghost pills stay click-only) shows a translucent preview that snaps to whole-day boundaries.
  - Dropping over another leg **swaps positions** of those two legs; dropping into empty trip days **moves the leg** to start on that day (other legs after it shift to fill the gap, preserving each leg's night count).
  - Constraint: the leg train always stays inside the trip's `start_date`..`end_date`. If a swap/move would push legs past the end, the drop is rejected with a toast: `Won't fit — extend trip dates first.`
- Persistence: build the new ordered `LocationSegment[]` and reuse `computeReorderPatches(activeTrip, newOrder, items)` + `bulkUpdateItemDates(patches)` from `src/lib/segments.ts` and `useTripStore`. This is exactly what the Edit Trip → Segments tab already does, so behavior stays consistent.
- Click (no drag) still opens `LocationLegDialog` as today.

## 3. Vertical rainbow columns by location (replace horizontal category bands)

- Remove the per-category `CELL_BG` tints (`bg-[hsl(var(--cell-stays))]`, etc.) so category rows have neutral backgrounds.
- Each day-column instead gets a faint background tint derived from which leg covers that day. Tint is applied to: the location cell, all 4 category cells, and the daily-$ footer cell of that column — producing a continuous vertical band per leg.
- Color mapping: legs are assigned colors in chronological order from a 7-stop rainbow palette — red, orange, amber, green, teal, blue, violet (extend with a second pass at lower saturation if there are >7 legs).
- The leg pill itself in the Location row uses the same color (slightly stronger) as a header for its column band, so the eye reads "this whole vertical stripe = Tuscany," "this whole stripe = London," etc.
- Days with no leg (gaps) stay neutral background.
- Tokens: add 7 HSL variables in `index.css` (`--leg-1` … `--leg-7`) with two opacities — a `~10%` fill for cells and `~25%` for the leg pill — so it stays within the Quiet-Luxury palette and works in any theme.

### Technical details

- Files touched:
  - `src/components/workspace/MatrixGrid.tsx` — add start-date popover; make Location-row pills draggable; replace `CELL_BG` with a per-column `legColorFor(dateStr)` helper applied to each cell wrapper.
  - `src/index.css` — add `--leg-1`…`--leg-7` HSL tokens.
  - `src/lib/segments.ts` — small helper `assignLegColors(segments)` returning a `Map<segId, tokenIndex>` based on chronological order.
- Reuses existing logic; no schema or RLS changes.
- Out of scope: changing trip *end* date inline (still in Edit Trip), drag-resizing leg length on the grid, recoloring the Calendar view.

### Validation

- Click `Trip starts: Aug 20 ▾`, pick Aug 13 → every item and the trip range slides 7 days earlier; UK leg keeps its night count.
- Drag the UK leg pill past the Italy leg → legs swap, item dates re-anchor via `computeReorderPatches`, and the rainbow stripes redraw so UK's color follows it to its new position.
- Matrix shows continuous vertical color bands instead of horizontal pastel rows; gaps between legs are uncolored.
