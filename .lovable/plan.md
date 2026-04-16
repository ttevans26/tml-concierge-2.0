

## Plan: Geographic URL Parser for Google Maps Links

### Problem
Pasting a Google Maps URL into the "Import via URL" scraper sends it to the `scrape-and-parse` edge function, which tries to fetch the HTML and parse travel items via AI — this fails for Maps URLs because the content is JavaScript-rendered and yields no meaningful text.

### Solution
Intercept Google Maps URLs client-side in `StudioWorkbench.tsx` before they hit the edge function. Extract the place name from the URL, resolve it via the existing Google Places API (`useGooglePlaces` hook), and add the item directly to the active folder with full metadata.

### Implementation Steps

**1. Add Google Maps URL detection and parsing in `StudioWorkbench.tsx`**

Update `handleScrape` to detect Google Maps URLs (patterns: `google.com/maps/place/`, `maps.google.com`, `goo.gl/maps`, `maps.app.goo.gl`) and branch into a dedicated `handleGoogleMapsUrl` flow instead of calling the edge function.

The parser will extract the place name from the URL path (e.g., `/maps/place/La+Trattoria/...` → `"La Trattoria"`), or fall back to extracting coordinates from `@lat,lng,zoom` patterns.

**2. Resolve via Google Places API**

Use the existing `useGooglePlaces` hook's `search()` and `getDetails()` to:
- Search for the extracted name (appended with the active folder's location for geo-context, e.g., "La Trattoria, Antibes")
- Auto-select the first high-confidence match
- Fetch full details: name, address, coordinates, rating, photos, website

**3. Auto-add to active folder**

On successful resolution, call `addItem()` with all metadata populated (`google_place_id`, `lat`, `lng`, `api_metadata` with rating/photo/hours). Show a success toast. The store update will trigger the Proximity Map to re-render with the new pin.

**4. Proximity Map auto-zoom**

The existing `StudioMap.tsx` already watches `activeFolder.items` and recalculates bounds on change. Adding a new item with coordinates will automatically trigger a re-render with the new marker and adjusted viewport. No map changes needed.

**5. "Search Manually" fallback**

If the Places API search returns no results or fails:
- Show a toast with a "Search Manually" action button
- Pre-fill the `AddStudioItemDialog` with the extracted name and open it automatically
- Add state: `prefillTitle` and pass it to the dialog

### Files Modified
- `src/components/studio/StudioWorkbench.tsx` — Add Maps URL detection, Places resolution, fallback dialog pre-fill

### Technical Details

URL parsing regex patterns:
```text
/maps\/place\/([^/@]+)/     → extract name from path
/@(-?\d+\.\d+),(-?\d+\.\d+)/ → extract coords as fallback
/maps\.app\.goo\.gl/        → short link detection (fetch redirect)
```

The `useGooglePlaces` hook needs a minor enhancement: expose a `findPlace(query)` method that combines `search` + auto-select first result + `getDetails` in one call. Alternatively, we use `PlacesService.findPlaceFromQuery` directly (already used in StudioMap's resync logic).

Since the Google Maps JS API is already loaded, we can use `google.maps.places.PlacesService.findPlaceFromQuery` directly in the handler without modifying the hook.

