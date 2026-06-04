# Trip-card route map — fix wrong / Africa locations

## What's actually wrong

Inspected the live data + the current `TripRouteMap` / `tripRoute.ts` / `Index.tsx` pipeline. Three real bugs make the card map wrong:

### 1. Valid single-city destinations are being rejected as "multi-region"

`isSingleRegionDestination` in `Index.tsx` counts commas — so `"Mexico City, CDMX, Mexico"` is flagged multi-region and the card falls back to the empty state instead of geocoding to Mexico City. Same trap for `"Paris, Île-de-France, France"`, `"London, UK"` etc.

### 2. Initial map center is in Africa

`TripRouteMap` mounts the `google.maps.Map` with `center: { lat: 30, lng: 10 }` (Libya) as a "temp" before the geocode resolves — so the user sees Africa flash, and if the geocode fails (or the viewport check rejects it) the map sits on Africa until the empty-state overlay paints.

### 3. Stay geocoding has no country bias

For Europe 2026, stays like `"Airbnb St Remy"` / `"Airbnb Antibes"` have no `location_name` and no coords. They get fed raw to Google with no `componentRestrictions` and no `bounds`, so results can be the wrong "St Remy" / "Antibes" worldwide. The `viewportOk` check only runs on the fallback query, not on per-stay geocodes, so a bogus centroid still gets pushed into `bounds.extend(...)` and warps the fitBounds toward Africa / mid-Atlantic.

## Fix

### `src/pages/Index.tsx`
- Remove the comma-count heuristic. Always pass `trip.destination` as `fallbackQuery` when waypoints come back empty. The viewport-size guard in `TripRouteMap` already rejects useless multi-country centroids — that's the right place for it.

### `src/lib/tripRoute.ts`
- Add a single up-front `geocodeDestinationContext(destination)` call inside `buildRouteWithGeocoding` that returns `{ countryCodes: string[], bounds: LatLngBounds | null }` parsed from `address_components` of the destination geocode. For `"UK, France, Italy"` split on commas first and geocode each piece to collect multiple country codes.
- Pass that context to `geocodeOnce(query, ctx)` so per-stay geocodes use Google's `componentRestrictions: { country: ctx.countryCodes }` and `bounds: ctx.bounds` for biasing.
- In `geocodeOnce`, reject any result whose viewport spans > 8° lat or lng (tighter than the 15° map-level guard — a single stay should be city-sized) and any result whose `country` component isn't in `ctx.countryCodes` when context is present.
- Keep `ROUTE_HINTS` and stored-coord paths as the first choice (no change).

### `src/components/trips/TripRouteMap.tsx`
- Don't create the `google.maps.Map` until we have either (a) at least one waypoint or (b) a successful fallback geocode. While neither has resolved, keep `status = "loading"` and render only the "Drawing route…" overlay over an empty container — no map instance, no `{lat:30,lng:10}` center.
- For the fallback-geocode path, resolve the geocode first, then construct the map centered on the result. Apply the same `viewportOk` check (already there) but bump it from 15° to 12° to better match continent-vs-country.
- Apply the per-stay viewport/country validation at the bounds step too: skip `bounds.extend` for any waypoint whose lat/lng is outside the destination context bounds (when available). This prevents a single bad geocode from dragging the whole route.

## Result per trip

- **Mexico City** (`"Mexico City, CDMX, Mexico"`, no stays) → geocodes destination → single pin on CDMX. No Africa.
- **Tokyo New Years 2026** (`"Tokyo"`, no stays) → single pin on Tokyo (already worked).
- **Europe 2026** (`"UK, France, Italy"`, 7 stays, 2 with coords) → country context = `[GB, FR, IT]`. Stays geocode within those countries only: Paris (stored) → Ortisei (stored) → Salò (from `location_name`) → Bath (from `location_name`) → Sherborne (hint). St Rémy / Antibes Airbnbs that have no `location_name` are biased to FR and resolve to the correct cities; if Google still returns nothing within FR, they're skipped instead of pulling the route into Africa.

## Out of scope

- Matrix grid layout changes (separate thread already in progress).
- Reverse-geocoding stored stays to backfill missing `location_name` in the DB — handled by the in-trip workspace, not this card.
