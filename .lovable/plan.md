## Goal
Restructure Stays so each Stay is **one row with a check-in → check-out range** (mirroring how Locations work today). Add a proper Edit Stay dialog with range pickers, fix the buggy grid drag-and-drop, and add an edge-drag resize. Location membership stays **derived from date overlap with Location segments** — no FK, no required parent.

## Root issues today
- Each Stay is stored as **one row per night** and pills are *derived* by consolidating consecutive rows with the same title+place. This causes:
  - Brittle merges (rename the hotel → pill splits)
  - "Date assignment" is implicit and only via DnD
  - Resize is impossible
  - DnD moves all N rows in lockstep; any partial failure leaves orphans
- Cost summed per `date` ignores multi-night allocation.

## New model (no DB migration required — reuse JSONB)
A Stay row in `itinerary_items` (`category='stays'`):
- `date` = **check-in** (first night)
- `metadata.end_date` = **last night, inclusive** (matches Locations convention)
- `metadata.nightly_rate?` (optional) — display only
- `cost` = total trip-line cost for the stay
- `location_name`, `google_place_id` — unchanged
- *(No FK to a Location row — membership is derived by date overlap.)*

Backwards compatibility: legacy per-night rows (no `metadata.end_date`) keep rendering via the existing `stayGroupKey` consolidation in `getStayPills`. New writes always use the range model. A future "Compact stays" backfill is out of scope.

## Changes

### 1. `src/lib/locationLegs.ts` — `getStayPills` hybrid
- If a row has `metadata.end_date`, emit one pill for that single row (range-based). Skip group-merging — the row IS the pill.
- If no `metadata.end_date`, keep today's consecutive-night consolidation (legacy fallback).
- Add `derivedLocation: string | null` on the pill, computed from the Location legs whose range overlaps the stay's start date.

### 2. New `src/components/workspace/EditStayDialog.tsx`
- Two shadcn Calendar popovers: Check-in, Check-out (check-out is "morning of" — exclusive). Both clamped to `[tripStart, tripEnd]`. Check-out must be > check-in.
- Shows derived nights and the inferred Location chip ("Inside: Paris") read-only — sourced from current Location segments.
- Hotel name (text), `PlaceAutocomplete` for property, total cost, nightly rate (optional), confirmation code, cancellation deadline (existing fields).
- On save: write one row with `date = check_in`, `metadata.end_date = check_out − 1 day`.
- Delete button removes the single row. For legacy multi-row stays opened from a derived pill, treat Save as a "convert": delete the extra rows and persist a single range row.

### 3. `AddItemDialog.tsx`
- When `category === 'stays'`, render the same range pickers and persist a single range row (no per-night fan-out).

### 4. `MatrixGrid.tsx` — Stays drag + resize
- **Move** (`handleDrop` stay-pill branch): compute delta; patch the single row's `date` and shift `metadata.end_date` by the same delta in one `updateItineraryItem` call. For legacy multi-row pills, keep the existing per-row bulk patch path.
- **Right-edge resize handle**: add a 6 px grab strip on the right edge of each Stay pill. Drag to extend/shrink — snaps to day columns. Updates `metadata.end_date` only. Min 1 night, max clamped to `tripEnd`.
- **Left-edge resize handle**: same on the left; updates `date`. Won't allow `date >= end_date`.
- Touch targets: handles widen on hover; pill body remains the drag-to-move target.
- Lane stacking via existing `assignLanes` — no change needed; overlaps stack visually (per user choice).

### 5. Conflict logic (`src/lib/conflictResolution.ts`)
- Drop the hard "1 stay/night" rule. Overlapping stays render in stacked lanes (already supported) and only surface a soft warning chip on the pill ("Overlaps {OtherStay}") — never block save.

### 6. Daily totals (`MatrixGrid.tsx` `dailyTotals`)
- For Stays with a range, allocate `cost / nights` to each covered day so the "Daily $" row reflects nightly burn. Other categories continue summing by `date`.

### 7. Memory update
After build, update `mem://logic/stay-mapping` and the related Matrix Logic note to reflect: Stays are one range row; location is derived; overlaps allowed (stacked).

## Out of scope
- No new DB columns / no migration.
- No explicit Stay→Location FK (kept as a future option).
- No automatic backfill of legacy per-night rows; legacy rows still render via fallback.
- No Splurge Engine re-architecture — only the daily allocation tweak above.

## Files
- `src/lib/locationLegs.ts` — hybrid `getStayPills` + `derivedLocation`
- `src/components/workspace/EditStayDialog.tsx` — new file (range-based)
- `src/components/workspace/AddItemDialog.tsx` — Stays branch with range pickers
- `src/components/workspace/MatrixGrid.tsx` — drop handler, resize handles, daily totals allocation
- `src/lib/conflictResolution.ts` — soften stay-overlap rule
- `mem://logic/stay-mapping` (memory update at end)
