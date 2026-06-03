# Trip Workspace Proximity Map

Studio already renders a real Google Map (`src/components/studio/StudioMap.tsx`). The Trip Workspace right sidebar currently only has Budget + Concierge tabs — no map. This adds a real proximity map for the active trip's itinerary items, reusing the existing Google Maps infrastructure.

## Scope

- New right-sidebar tab in `TripWorkspace.tsx`: **Map** (alongside Budget, Concierge).
- New component `src/components/workspace/ProximityMap.tsx` rendering an interactive Google Map.
- Plots all `itineraryItems` that have coords (Stays, Dining, Activities, Sites) for the active trip.
- Anchor Stay (active anchor) gets a distinct ring; other categories use existing color tokens.
- Auto-fit bounds; single-pin → center+zoom 15.
- Click pin → InfoWindow with title, time, day badge, category.
- Day filter chips at top: All · Day 1 · Day 2 … — filters which pins show.
- Empty state when no pinned items: prompt + link to Studio.
- Background auto-heal: for items missing coords but with a `google_place_id`, look up via Places; for those with only a title+address, run `healItemCoordinates` style lookup (lighter version — does NOT mutate studio_items; updates `itinerary_items.api_metadata.lat/lng` via existing store mutation).
- Reuses `loadGoogleMapsScript`, diagnostics banner, and styling from `StudioMap`.

## Out of scope

- Mapbox (Google Maps connector is already wired; no need to introduce a second provider).
- Routing/directions lines between pins (future).
- Drag-to-reorder on map.
- Mobile bottom-sheet map view (workspace right-panel is lg+ only; mobile keeps current behavior).

## Technical notes

**Files**
- `src/components/workspace/ProximityMap.tsx` — new. Mirrors `StudioMap` structure but reads from `useTripStore`.
- `src/pages/TripWorkspace.tsx` — extend `rightTab` union to `"budget" | "concierge" | "map"`, add tab button (Map icon from lucide), render `<ProximityMap />`.
- `src/stores/useTripStore.ts` — add helper `updateItineraryItemCoords(id, {lat, lng, place_id})` that patches `api_metadata` (no schema change; coords live in JSONB).
- `src/lib/itineraryGeocode.ts` — new tiny helper wrapping `geocodeAddress` / Places `findPlaceFromQuery` for itinerary items, persisting via the store mutation above. Keeps `googleMaps.ts` clean (which is studio-specific via `studio_items` writes).

**Data model**
- No DB migration. Itinerary item coords are stored in `itinerary_items.api_metadata` JSONB as `{lat, lng, google_place_id, formatted_address}`. The `getCoords()` helper checks both top-level and metadata, matching the Studio pattern.

**Pin colors** (semantic tokens via inline hex, matching StudioMap convention since gmaps SymbolPath needs raw hex):
- stays → `#5B6B8A`, dining → `#5B9A6B`, activity → `#B8934A`, transport → `#7A7A7A`, sites → `#8A5B9A`.
- Active anchor stay → larger scale (10) + accent stroke `#9B7E4B`.

**Performance**
- One map instance per workspace session; markers cleared/rebuilt on `itineraryItems` change. Acceptable at MVP item counts (<100).

**Diagnostics**
- Reuses `subscribeGoogleMapsDiagnostics` so the same amber banner appears if the key/referrer is misconfigured.
