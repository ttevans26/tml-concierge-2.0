## Plan

1. **Stop the geocoder crash**
   - Update `src/lib/tripRoute.ts` so Google geocoding never passes an array to `componentRestrictions.country`; Google requires a single string.
   - For multi-country trips like `UK, France, Italy`, skip the country restriction and rely on explicit route hints / stored coordinates instead.

2. **Use location rows as the route source**
   - Make the route builder prioritize itinerary items where `category === "location"` and use their `location_name` / `title` as the canonical stops.
   - Add exact location hints for the requested route stops:
     - Paris
     - St Remy-Provence
     - Antibes
     - Ortisei
     - Salo Lake Garda
     - Bath UK
     - Sherborne UK
   - Return those pins in that order without depending on hotel/stay names.

3. **Prevent infinite “Drawing route…”**
   - Wrap the route-building call on the Your Journeys page in error handling so a geocoding exception resolves to an empty/fallback state instead of leaving `waypoints` stuck as `null`.
   - Add defensive error handling inside `TripRouteMap` so a Google Maps load/render exception changes the UI to “Map unavailable” rather than hanging.

4. **Verify the fix**
   - Check the preview console no longer shows `InvalidValueError: componentRestrictions.country: not a string`.
   - Confirm the Europe 2026 map renders pins for all seven location stops and draws the route line between them.