## Problem

The Static Maps swap broke the dashboard map: the referrer-restricted browser key isn't authorized for the Static Maps API, so the `<img>` fails and the card falls back to the "Add stays with locations..." empty state — even when waypoints exist. The user only wanted the static optimization for iOS, where the interactive map was slow.

## Plan

**1. Platform detection helper** — `src/lib/platform.ts`
- `export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)`
- SSR-safe guard on `navigator`.

**2. `TripCard` in `src/pages/Index.tsx`**
- Restore the original dynamic `TripRouteMap` import + render as the default.
- Branch once on mount: `const useStatic = isIOS()`.
  - **Desktop / Android / everything else:** render `<TripRouteMap waypoints={...} isLoading={...} />` exactly like before the swap. No cache reads, no signature work.
  - **iOS only:** render `<TripRouteStaticMap waypoints={...} />` with the existing `routeCache` flow (instant paint from cache, background `buildRouteWithGeocoding` + signature compare on change).
- Keep `TripRouteStaticMap` and `src/lib/routeCache.ts` as-is — they remain used on iOS.

**3. Static Maps key fix (iOS path only)**
- The managed browser key is referrer-restricted to Maps JS + Places New and returns `REQUEST_DENIED` for `maps/api/staticmap`. Two options:
  - **a. Route Static Maps through the connector gateway** (`/maps/api/staticmap?...`) so it uses the server-side key. Implement by changing `buildStaticUrl` in `TripRouteStaticMap.tsx` to return a gateway URL and load the image via a tiny `useEffect` that fetches with `Authorization` + `X-Connection-Api-Key` headers, converts the response to a blob URL, and sets `<img src>`. This keeps iOS fast and actually renders.
  - **b. Fallback:** if the gateway image fetch fails, render the dynamic `TripRouteMap` on iOS too (slower but correct).
- I'll implement (a) with (b) as a graceful fallback inside `TripRouteStaticMap`.

**4. No DB / schema / other UI changes.** Studio redesign from the previous turn stays intact.

## Files

- New: `src/lib/platform.ts`
- Edit: `src/pages/Index.tsx` (TripCard branch)
- Edit: `src/components/trips/TripRouteStaticMap.tsx` (gateway-fetched blob URL + dynamic fallback)

## Out of scope

- Service worker / offline caching of the static PNG.
- Changing the in-trip workspace `ProximityMap`.
