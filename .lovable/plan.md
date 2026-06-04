# Fix: Erroneous "Null Island" Points on Trip Route Map

## Diagnosis

The marker labeled **7** sitting in the Gulf of Guinea (0°N, 0°E) is the classic "Null Island" symptom: itinerary items stored with `location_lat = 0` and `location_lng = 0` (or very near it) are being treated as valid coordinates. Multiple stay labels are stacking on that single point.

Current code in `src/lib/tripRoute.ts → buildRouteFromItems()` only checks `Number.isFinite(lat)` — which passes for `0`. There's also no destination-context filter on the direct-from-items path (only `buildRouteWithGeocoding` applies the country/bounds filter).

## Changes

### 1. `src/lib/tripRoute.ts`
- In `buildRouteFromItems()`, reject coordinates where both lat and lng are within ~0.01° of (0,0), and reject any single coord with `|lat| < 0.001 && |lng| < 0.001`.
- Add a shared `isLikelyNullIsland(lat, lng)` helper and apply it in both `buildRouteFromItems` and the `stored` branch of `buildRouteWithGeocoding`.
- In `buildRouteWithGeocoding`, when a `DestinationContext` with `bounds` exists, also filter `buildRouteFromItems`-derived waypoints (current code returns `directFallback` unfiltered at the end). Pass bounds through and drop any waypoint outside it.

### 2. `src/components/trips/TripRouteMap.tsx`
- Before mounting the waypoints map, filter out any waypoint with `(|lat|<0.001 && |lng|<0.001)` as a defensive last line.
- If after filtering no waypoints remain, fall through to the fallback-query path instead of centering on a bad coord.

### 3. Optional cleanup pass (no DB write)
- No migration; this is purely a presentation-layer filter. The underlying bad rows in `itinerary_items` remain but stop polluting the map. (If you want, I can follow up with a one-off script to null-out `location_lat/lng = 0` rows — say the word.)

## Result
Markers stop appearing in the Gulf of Guinea. The Europe 2026 map will show only Paris + the Italy cluster (and any other stays with real coords). Anything geocoded outside the destination country gets dropped.
