## Plan

1. **Fix the route builder for Europe 2026**
   - Update the journey route logic so it uses the trip’s explicit `location` itinerary rows as route stops, not only `stays`.
   - Preserve chronological ordering so the route captures Paris → Saint-Rémy-de-Provence → Antibes → Ortisei → Salò → Bath → Sherborne.
   - Keep the existing bad-coordinate protections that filter out Null Island / Africa-style erroneous points.

2. **Make geocoding tolerant of multi-country trips**
   - Avoid over-restricting Google geocoding to the first country in `UK, France, Italy`, which can block later Italy/UK legs.
   - Prefer known Europe 2026 route hints for ambiguous rows like St Rémy, Antibes, Salò, Bath, and Sherborne.

3. **Improve map loading behavior**
   - Ensure the map leaves “Drawing route…” once the route is built or a fallback state is reached.
   - Keep the dashboard card UI unchanged aside from the route map actually rendering.

4. **Verify with real trip data**
   - Re-check the Europe 2026 itinerary rows and confirm the generated waypoint list includes all expected legs and no bad offshore/Africa coordinates.