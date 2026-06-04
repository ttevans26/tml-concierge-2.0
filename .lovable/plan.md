## Goal
Make the Calendar view reflect the new single-row stay schema produced by `StayDialog` (one row per stay with `metadata.end_date` as the last night inclusive). Each stay should render as one pill that spans contiguous date cells matching its check-in → check-out range, identical to how the Matrix Grid renders stay pills.

## Problem
`src/components/workspace/CalendarStaysView.tsx` still uses legacy logic: it expects one `itinerary_items` row per night and groups consecutive rows by `title|location` key. With the new schema there is only one row per stay, so:
- Multi-night stays show as a 1-day pill on the check-in date only.
- Stays imported/edited via the new `StayDialog` never span across the grid.
- Empty banners appear because grouping/key collisions miscount stays.

## Fix (scope: `CalendarStaysView.tsx` only)

1. Replace `groupStays(items)` with a direct mapping: each stay row → one `StaySegment`:
   - `startDate = parseISO(item.date)` (check-in)
   - `endDate` = last night inclusive, derived in order:
     1. `item.metadata.end_date` (new schema)
     2. `item.metadata.check_out` minus 1 day (exclusive checkout)
     3. fallback to `startDate` (single-night)
   - `key = item.id` (stable, unique — fixes color/legend collisions)
   - `colorIndex = hashIndex(title|location, palette.length)` (keep same-property color consistency)
   - `items: [item]` (no more multi-row aggregation)
2. Sort segments by `startDate` ascending.
3. Keep existing week-slicing, lane assignment, mobile agenda list, legend, and `EditItemDialog` open-on-click behavior — they already work off `startDate`/`endDate`.
4. Nights label stays as `differenceInCalendarDays(endDate, startDate) + 1`.
5. Guard against malformed metadata (string vs Date) with a small `parseMaybeIso` helper.

## Out of scope
- No changes to `MatrixGrid`, `StayDialog`, store, schema, or other views.
- No drag-to-resize on the calendar (still click-to-edit, which opens `StayDialog` via `EditItemDialog` → existing pill click path). If you want true drag-to-resize on the calendar itself, that's a follow-up.

## Verification
1. Create a 5-night stay in Matrix → Calendar shows one pill spanning 5 day cells; legend lists it once with "5n".
2. Edit check-out in `StayDialog` → pill resizes accordingly.
3. Two overlapping stays on the transition day stack into two lanes without visual overlap.
4. Mobile agenda list shows each stay once with correct night count and date range.
