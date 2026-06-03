
# Location Row in Matrix Grid

Add a new top row, "Location", that defines the geographic context (city, state, country) for each leg of the trip, decoupled from Stays. Stays no longer enforce one-per-night.

## Data model

- New itinerary category enum value: `location` (added to the `category` USER-DEFINED type on `itinerary_items`).
- A Location item represents a leg and **spans a date range**, encoded as:
  - `date` = leg start (yyyy-MM-dd)
  - `metadata.end_date` = leg end (inclusive, yyyy-MM-dd)
  - `metadata.city`, `metadata.state`, `metadata.country` — structured fields
  - `title` = formatted label, e.g. `"Paris, Île-de-France, France"` (denormalized for list views and back-compat)
  - `location_name`, `google_place_id`, `location_lat`, `location_lng` — populated from Google Places (reusing `PlaceAutocomplete` with `types="cities"`).
- No schema changes beyond the enum value. Leg ranges live in JSONB; this keeps the change minimal and avoids a parallel table.

## Migration

Single migration: `ALTER TYPE category ADD VALUE IF NOT EXISTS 'location';`

No data backfill is written — see "Auto-derive" below.

## Matrix grid

```text
            Aug 21   Aug 22   Aug 23   Aug 24   Aug 25
LOCATION   [────── Paris, FR ──────][── Lyon, FR ─]
STAYS       Le Bristol  Le Bristol  Ritz   Cour    Cour
LOGISTICS   …           …           train  …       …
DINING      …
ACTIVITY    …
DAILY $
```

- Row height ~36px (slimmer than 112px category rows).
- A leg renders as a **single absolutely-positioned pill** sitting on top of the day grid, width = `nights × dayWidth`, label centered, truncated.
- Clicking an empty span opens a quick-create popover (city autocomplete → infers state/country from Google Places `address_components`). Clicking an existing pill opens an edit popover (rename, change place, delete) with drag handles on the left/right edges to resize the leg by whole days. Dragging the body moves the leg.
- Validation: legs cannot overlap. If a new leg overlaps an existing one, trim the existing leg(s) to make room (with a toast). Legs may have gaps (the grid just shows an empty Location row segment with a faint "+ Add location" affordance).

## Auto-derive from existing stays

On every load (pure, no DB writes):
- If a trip has zero Location items, `buildSegments` (in `src/lib/segments.ts`) already collapses consecutive same-`location_name` stays into segments. We render those segments as **ghost** Location pills (italic label, dashed border, "Derived from stays" tooltip).
- A "Confirm legs" inline button persists the ghost pills as real Location items in one batch. Until then they remain read-only suggestions and don't block stays editing.

## Stays row changes

- Drop the `stayOccupied` lockout in `MatrixGrid.tsx` so multiple stays can stack per night cell.
- Existing conflict-detection (`src/lib/conflictResolution.ts`) keeps flagging overlapping bookings as non-blocking warnings.
- The "+ Add" affordance always shows in the Stays cell regardless of occupancy.

## Files touched

- `supabase/migrations/<new>.sql` — add `location` enum value.
- `src/components/workspace/MatrixGrid.tsx` — insert LOCATION row above CATEGORIES; render spanning pills; remove `stayOccupied` gating; handle drop targets per leg.
- `src/components/workspace/LocationLegBar.tsx` (new) — pill component with drag-to-move, edge-to-resize, edit popover.
- `src/components/workspace/LocationLegDialog.tsx` (new) — create/edit form using `PlaceAutocomplete` (`types="cities"`); parses Google `address_components` for city/state/country.
- `src/lib/locationLegs.ts` (new) — pure helpers: `getLegs(items, trip)`, `getGhostLegsFromStays(items, trip)` (wraps `buildSegments`), `legOverlaps`, `trimOnConflict`, `formatLegLabel`.
- `src/stores/useTripStore.ts` — typing tweak so `ItineraryItem["category"]` includes `"location"`; helper `createLocationLeg`, `updateLocationLeg`, `confirmGhostLegs` (batch insert).
- `src/components/workspace/ItineraryItemCard.tsx` — hide Location items from non-Location rows (filter by `category !== "location"` where iterating all items).
- `src/lib/segments.ts` — extend `buildSegments` to prefer real Location items over stay-derived ones when present; falls back to current behavior otherwise. Used by `SegmentCard`, orphan detection, Trip Editor.

## Out of scope

- Sub-city granularity (neighborhoods).
- Mobile reflow of the spanning pill (will stack as a horizontally scrollable strip — same as today's grid).
- Migrating the New Journey seed flow to write Location items instead of (or in addition to) Stays. Currently it seeds Stays; we'll auto-derive ghost Location pills from them. A follow-up can move seeding directly to Location.
