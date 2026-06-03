
## Goal

The Matrix Location row already renders spanning pills (city/state/country) — the row "looks missing" because nothing seeds real `location` itinerary items today. `CreateTripDialog` only writes `stays`, so users see at most dashed *ghost* legs derived from stays (no state/country). We need real Location items written from the two intended entry points.

## Two workflows for Location data

**1) At trip creation (CreateTripDialog → useTripStore.createTrip)**
- Upgrade the city input in `CreateTripDialog` to use the existing `PlaceAutocomplete` component (already used elsewhere) so each selected city carries `city`, `state` (admin_area_level_1), `country`, and `google_place_id`. Free-text typing still allowed (state/country fall back to `null`).
- Extend the `CityRow` type from `{ id, name, nights }` to also include `state | null`, `country | null`, `google_place_id | null`.
- Extend `createTrip` options:
  ```ts
  options?: {
    seedStays?: { city: string; nights: number }[];
    seedLocations?: {
      city: string;
      state: string | null;
      country: string | null;
      googlePlaceId: string | null;
      nights: number;
    }[];
  }
  ```
- In `createTrip`, after seeding stays, walk `seedLocations` in order starting at `trip.start_date`, computing each leg's `startDate` and `endDate = startDate + (nights-1) days`. Insert one `itinerary_items` row per leg:
  ```
  category: 'location',
  title: "<city>, <state>, <country>" (compact, skip nulls),
  location_name: city,
  google_place_id: googlePlaceId,
  date: startDate,
  approval_status: 'confirmed',
  metadata: { end_date, city, state, country }
  ```
- `CreateTripDialog.handleSubmit` passes both `seedStays` and `seedLocations` derived from the same `cities` array (same nights cadence, guaranteed alignment).

**2) Manually in the Matrix grid (already wired, no changes required)**
- The "+ Location" affordance per empty day cell and pill click → `LocationLegDialog` already lets users add/edit a leg with city/state/country + Google Places autocomplete. The pill overlay renders the spanning bar above the Stays row.
- Confirm no regressions: leg overlap protection, click-to-edit, delete via dialog.

## Why the row "looks missing"

When a trip has no `location` items AND no `stays` items, the row renders as an empty band (label is still visible at left, but no pills). The current trip likely has stays only with ghost-leg derivation working — but on a freshly created trip with no stays yet, the user sees only the empty Location lane. After this change, real Location pills appear immediately on trip creation.

## Files to edit

- `src/components/CreateTripDialog.tsx` — swap city `Input` for `PlaceAutocomplete`; extend `CityRow`; pass `seedLocations` to `createTrip`.
- `src/stores/useTripStore.ts` — add `seedLocations` option; insert `location` rows in `createTrip`.
- `src/lib/locationLegs.ts` — reuse `formatLegLabel` for the title; no signature changes.

## Out of scope

- No schema migration (the `location` enum value already exists; columns already in place).
- No changes to MatrixGrid Location row rendering, Stay-pill rendering, ghost-leg logic, or `LocationLegDialog`.
- No changes to share/public views.

## Validation

- New trip with cities "Paris (3n), Lyon (2n)" → after creation, Matrix shows two solid Location pills spanning the right days with full "Paris, Île-de-France, France · 3n" labels; pills are clickable and edit via `LocationLegDialog`.
- New trip with only free-typed city text → pill shows just "Paris · 3n" (state/country null), still clickable.
- Adding a leg manually from an empty day cell still works exactly as today.
- Existing trips are unchanged; their ghost legs continue to display until the user clicks "Confirm N location legs" or edits a pill.
