## Goal
Refactor `CalendarStaysView` to consume the same canonical primitives as the Matrix Grid so it never drifts again. Today it has a hand-rolled stay-grouping function and opens the wrong edit dialog. After overhaul work on stays (`metadata.end_date` range rows, legacy per-night merging, derived legs, `StayDialog`), the calendar must reuse those shared utilities verbatim.

## What changes in `src/components/workspace/CalendarStaysView.tsx`

1. **Replace local `groupStays` with shared `getStayPills` from `@/lib/locationLegs`.**
   - Import: `getStayPills`, `assignLanes` (lane logic also already in this file is duplicated), `type StayPill`.
   - Compute `pills = getStayPills(itineraryItems, displayedLegs)` where `displayedLegs` comes from `getLegs(activeTrip, itineraryItems)` (same call MatrixGrid uses) so each pill inherits `derivedLocation`.
   - Drop the local `StaySegment` interface and `hashIndex`+palette index logic; derive `colorIndex` from `pill.id` (stable per pill, same as Matrix).
2. **Reuse date fields verbatim from `StayPill`:** `startDate`, `endDate`, `nights`. No more bespoke `metadata.end_date` / `check_out` parsing in this file — that lives in `getStayPills` and stays the single source of truth.
3. **Week slicing & lane assignment:** keep per-week slicing (calendar is multi-row weeks), but feed the slices into `assignLanes` from `locationLegs` instead of the local one. The current local `assignLanes` predates the shared one and uses different math; using the shared util keeps semantics aligned with the Matrix.
4. **Click → open `StayDialog` in edit mode (not `EditItemDialog`).**
   - Mirror MatrixGrid's `stayEdit` state shape: `{ open, pill }`.
   - Render `<StayDialog mode="edit" pill={stayEdit.pill} tripId tripStart tripEnd legs={displayedLegs} />` exactly like MatrixGrid lines 1458–1471.
   - Remove the `EditItemDialog` import and `editing` state.
5. **Legend & mobile agenda:** iterate over `pills` (one entry per pill, dedup by `pill.id`). Show `derivedLocation || locationName` as the subtitle so the calendar matches Matrix pill labels.
6. **Drag-and-drop (out of scope for this pass).** The user asked only that the data/structures match; leave calendar pills click-to-edit. Drag-resize/move on the calendar can be a follow-up — flagged in the file with a TODO comment so it's discoverable.

## Why this is safe

- `getStayPills` already handles both new range rows (`metadata.end_date`) and legacy per-night rows (consecutive-night merge by title+place+location). No data shape assumptions live in the calendar anymore.
- `StayDialog` is the same dialog the Matrix uses for create/edit and already collapses legacy multi-row pills on save, so edits from the calendar follow the same migration path.
- `displayedLegs` (from `getLegs`) is the same source the Matrix uses for `derivedLocation`, keeping labels consistent.

## Out of scope
- No store, schema, or `StayDialog` changes.
- No new drag-to-resize on the calendar.
- No changes to `MatrixGrid`, `segments.ts`, or `locationLegs.ts`.

## Verification
1. Trip with a 5-night range-row stay → calendar renders one pill spanning 5 cells with correct nights label; same as Matrix.
2. Trip with legacy per-night rows for the same hotel across 3 consecutive nights → one merged pill (3n), identical to Matrix.
3. Two overlapping stays on transition day stack into separate lanes (shared `assignLanes`).
4. Clicking a calendar pill opens `StayDialog` pre-filled (property type, rate, taxes, cleaning fee, listing URL all hydrated); saving updates the Matrix immediately via the same store path.
5. Legend lists each pill once, subtitle shows derived city when a Location leg overlaps.
