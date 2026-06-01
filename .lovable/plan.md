## Diagnosis

Console shows the root cause:

```
Google Maps JavaScript API error: RefererNotAllowedMapError
Your site URL to be authorized: https://id-preview--693f38f0-…lovable.app/studio
```

The hardcoded fallback key in `src/lib/googleMaps.ts` (`AIzaSyBYwYMC…`) is **not authorized** for the `id-preview--*.lovable.app` host. Because the script tag still loads (just in error mode), `google.maps.importLibrary` is never installed → `importLibrary is not a function` → `google.maps.Map is not a constructor` → `StudioMap` throws and the panel goes white.

## Fix

### 1. Connect the Lovable-managed Google Maps connector

The managed connector exposes `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, a referrer-restricted browser key already authorized for `*.lovable.app` and `*.lovableproject.com` — so previews and published Lovable URLs both work without any Google Cloud setup. I'll trigger `standard_connectors--connect` for `google_maps`.

### 2. Refactor `src/lib/googleMaps.ts`

- Prefer the connector key, then `VITE_GOOGLE_MAPS_API_KEY`, then the old hardcoded fallback (kept only as a last-ditch dev fallback).
- Switch the script URL to the documented async pattern with a `callback` and `channel`:
  ```
  https://maps.googleapis.com/maps/api/js?key=…&loading=async&libraries=places&callback=__tmlGmapsInit&channel=…
  ```
  Use the global callback to resolve `loadGoogleMapsScript()` (and as a safety net, still `await importLibrary("maps")` and `"places"` inside the callback before resolving). This eliminates the race that the previous patch tried to fix.
- Add an in-flight script de-dupe check (`document.querySelector('script[data-gmaps-loader]')`) so HMR / multiple components calling `loadGoogleMapsScript()` don't inject the script twice.

### 3. Make `StudioMap` degrade gracefully

In `src/components/studio/StudioMap.tsx`, wrap the `new g.maps.Map(...)` call in a guard: if `g?.maps?.Map` is undefined after `loadGoogleMapsScript()` resolves, render the existing "Oops" empty-state with a one-line hint ("Map unavailable — check Google Maps connection") instead of throwing an unhandled promise rejection. This keeps the rest of the Studio usable if the key is ever wrong again.

### 4. Replace the deprecated marker class

Console also flags `google.maps.Marker` deprecation. Per project guidance we must **not** switch to `AdvancedMarkerElement` (it requires a `mapId`). Keep `google.maps.Marker` for now — the deprecation is a warning, not the cause of the white screen. No change here; calling it out so we don't get distracted.

## Out of scope

- No DB changes.
- No changes to the Antibes / Lake Garda seed data.
- No changes to Studio data fetching, drag-and-drop, or proximity-ranking logic.
- Not touching `MatrixGrid` or `BudgetSidebar`.

## Files touched

- `src/lib/googleMaps.ts` — loader rewrite (callback-based, connector key first).
- `src/components/studio/StudioMap.tsx` — defensive guard around `new g.maps.Map(...)`.
- Connector linkage (`standard_connectors--connect google_maps`) — no file edit, just enables the env var.
