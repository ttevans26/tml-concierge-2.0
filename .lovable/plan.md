## Route Map Visual on Trip Cards

Add an illustrative route map (numbered waypoints + dashed connecting line, Apple/Monocle-style) for each trip, surfaced via an **expanded trip card** on the "Your Trips" page.

### Data source

The route is derived from existing itinerary data — no new tables. We compute a sequence of geographic waypoints from `itinerary_items` of category `stays` (and `logistics` arrival points as fallback), ordered by `date`, deduplicated by `location_name` / `lat,lng`. Each stay's `lat`/`lng` is already populated via the existing Google Places healing path (`src/lib/googleMaps.ts`). Trips with fewer than 2 unique waypoints fall back to a single pin centered on the destination.

### UX

1. On `/` (Your Trips), each `TripCard` gets a small "Expand" affordance (chevron in top-right).
2. Clicking it (not the card body — card body still navigates to `/trip/:id`) toggles the card into an **enlarged state** that spans the full grid row (`col-span-full`) and reveals a map panel beneath the existing info strip.
3. The map shows:
   - Numbered circular waypoint markers (1, 2, 3…) in Onyx with a thin Bronze Beige ring
   - Dashed accent-colored polyline connecting waypoints in date order
   - City label next to each pin (`Playfair`, small)
   - Auto-fit bounds with padding
4. A second click on the chevron (or an X) collapses it back to the compact card.
5. Mobile: enlarged view stacks map below info; height ~260px.

### Visual treatment

- Google Maps JS API (already wired via `loadGoogleMapsScript` in `src/lib/googleMaps.ts`) — no new key.
- Minimal map style: muted greens/creams/blues, no POIs, no transit, to match the Quiet Luxury aesthetic and read like the reference screenshot.
- Markers: custom SVG (numbered circle, Onyx fill, Cream numeral, 0.5px Bronze ring).
- Polyline: dashed (via repeated symbol), `hsl(36 45% 42%)` (Bronze Beige) at 60% opacity, weight 2.

### Technical details

**New files**
- `src/components/trips/TripRouteMap.tsx` — wraps `google.maps.Map`, accepts `waypoints: { lat, lng, label, order }[]`, draws markers + dashed polyline, auto-fits bounds. Loading + empty states.
- `src/lib/tripRoute.ts` — `buildRouteFromItems(items: ItineraryItem[]): Waypoint[]` — orders stays by date, dedupes by rounded lat/lng, falls back to logistics arrivals.

**Edits**
- `src/pages/Index.tsx` — track `expandedTripId` state; render expanded card with `col-span-full` and embed `<TripRouteMap />`. Add chevron toggle that `stopPropagation`s.
- `src/stores/useTripStore.ts` — add a lightweight `fetchTripItems(tripId)` cache (or reuse `fetchItineraryItems`) so the dashboard can lazily load items only for the expanded trip, not all trips upfront.

### Out of scope

- Persisting expanded state across sessions
- Editing the route or dragging pins
- Showing dining/activity pins (only stay-to-stay route, per the reference)
- A separate map view inside `/trip/:id` (this only touches the Your Trips page)
