
# New Journey Flow — Multi-City Destinations

Replace the single-destination input in `CreateTripDialog` with an ordered, reorderable list of cities, each with its own night count, plus a live warning when the sum of nights doesn't match the trip's date range.

## UX

Dialog fields (top-to-bottom):
1. **Trip Name** (unchanged)
2. **Start Date / End Date** (unchanged — derives `tripNights = endDate - startDate`)
3. **Destinations** (new)
   - `PlaceAutocomplete` (cities) + "Add" button → appends city to ordered list
   - Each row shows: drag handle (≡), city name, nights stepper (− N +, min 1), remove (×)
   - Rows are reorderable via drag-and-drop (dnd-kit, same pattern as `SegmentCard.tsx`)
   - Below the list: live summary — `Σ nights / tripNights nights planned`
   - If `Σ nights ≠ tripNights` and both dates set → amber inline warning:
     *"Your city stays add up to X nights but the trip is Y nights. You can continue — adjust later in the workspace."*
   - Submit stays enabled regardless of the mismatch (warning is non-blocking)

```text
┌─ Destinations ──────────────────────────┐
│ [ search city…              ] [ Add ]   │
│ ─────────────────────────────────────── │
│ ≡  Tokyo, Japan          [− 3 +]   ×    │
│ ≡  Kyoto, Japan          [− 2 +]   ×    │
│ ≡  Osaka, Japan          [− 2 +]   ×    │
│                                         │
│ 7 of 7 nights planned                   │
└─────────────────────────────────────────┘
```

## Persistence

- `trips.destination` (existing `text` column) → stored as comma-joined ordered city names for back-compat (e.g. `"Tokyo, Kyoto, Osaka"`). First city becomes the primary destination shown on the trip card.
- Per-city nights are seeded into the itinerary on create: for each city, insert one `itinerary_items` row per night with `category='stays'`, `title="Stay — <city>"`, `location_name=<city>`, `approval_status='draft'`, dates filled sequentially from `start_date`. This makes the existing `buildSegments` logic (in `src/lib/segments.ts`) immediately produce correct location segments in the workspace.
- If end_date or start_date is missing, skip seeding (cities are stored in `destination` only).
- No DB migration required.

## Files changed

- `src/components/CreateTripDialog.tsx` — full rewrite of the form body; add local `cities: { id, name, nights }[]` state, dnd-kit `SortableContext` + a small `<CityRow>` subcomponent. Submit handler builds the `destination` string and an optional `seedStays` array, passes both to `createTrip`.
- `src/stores/useTripStore.ts` — extend `createTrip` signature to accept an optional `seedStays?: { city: string; nights: number }[]`. After inserting the trip, if `seedStays` and `start_date` are set, batch-insert one `stays` itinerary item per night via the existing `itineraryItems` service. Keep current behavior when `seedStays` is omitted.

## Out of scope

- Editing the multi-city plan from `EditTripDialog` (can be a follow-up; user can still edit individual stays in the workspace).
- New DB columns for structured city/nights — using existing `destination` text + seeded stays keeps schema stable and the Matrix grid populated from day one.
