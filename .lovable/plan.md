## 1. Trip route map — cached static image (auto-updates on itinerary edits)

**Problem:** Trip cards on `/` render `TripRouteMap` which loads the Google Maps JS SDK, geocodes stays, and streams tiles. On iOS it stalls at "Drawing route…".

**Fix:** Render the route as a **Google Static Maps image** (`<img src=…>`). One PNG, no SDK load.

### Implementation
- New `src/components/trips/TripRouteStaticMap.tsx`:
  - Builds a Static Maps URL with numbered markers + dashed polyline from resolved waypoints, using `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (referrer-restricted, safe in-browser).
  - Quiet-luxury `style=` params (muted POIs, soft landscape, bronze admin borders).
  - Falls back to `center=<destination>&zoom=5` while waypoints are still resolving.
- New `src/lib/routeCache.ts`:
  - LocalStorage cache `tml-route-cache-v1` keyed by `trip.id`.
  - Value: `{ waypoints, signature, updatedAt }`. `signature` = hash of `trip.updated_at` + hash of each item's `(id, date, location_lat, location_lng, category, sort_order)`.
- Rewire `src/pages/Index.tsx` `TripCard`:
  1. Read cache → if hit, paint static image instantly.
  2. In parallel, fetch items + recompute signature → if changed, run `buildRouteWithGeocoding`, update cache, swap `<img src>`.
  3. Subscribe to `useTripStore` mutations for that trip → invalidate that entry so add/remove/reorder/date-shift updates the image immediately.
  4. Brand-new trip with no cache + no waypoints → lightweight placeholder (destination text + MapPin) for ~1s, then static image. No more "Drawing route…" spinner.
- Keep `TripRouteMap.tsx` in repo for any other caller; dashboard no longer uses it.

## 2. Studio shell — Design Lab redesign

Two distinct states, both two-column. Never three columns again.

### State A — No folder selected (Design Lab landing)
- **Full-width header band** at top spanning both columns. Contains everything from today's center column:
  - "DESIGN LAB" eyebrow
  - Playfair title *"The atlas of your ideas"*
  - Subtitle paragraph
  - `Paste Social Link` primary button + `SocialImportsTray` inbox chip (the redundant `Social` button is removed)
- **Body below**, two columns:
  - Left ~40%: Ideas Vault (folder list)
  - Right ~60%: Proximity Map (the bronze globe gets room to breathe)
- Mobile: header band stacks on top, then Ideas Vault below. Proximity Map collapses into the folder-open flow per today's mobile pattern.

### State B — Folder selected (Working view)
- **Two columns only**: Workbench (folder contents + saved places) | Proximity Map.
- The Ideas Vault (left toolbar of other folders) is **collapsed by default** behind a hamburger button in the Workbench header.
  - Hamburger toggles a slide-in overlay panel (Sheet on mobile, animated left panel on desktop) listing all folders so the user can switch.
  - Clicking a folder closes the overlay and swaps the active folder.
  - State persists in `useStudioStore` so the user's last open/closed preference is remembered across navigation.
- Workbench itself is unchanged internally (Find-a-Place, Scrape, categorized item lists, anchor logic).

### Files touched
- `src/pages/Studio.tsx` — branch on `activeFolder`:
  - No folder → render `StudioDesignLab` (header band + 2-col Vault/Map ResizablePanelGroup).
  - Folder selected → render 2-col `Workbench | ProximityMap` ResizablePanelGroup, with `<FolderSwitcherDrawer />` mounted (hamburger button lives inside `StudioWorkbench` header).
- New `src/components/studio/StudioDesignLab.tsx` — header band + 2-col body. Reuses `StudioVault`, `StudioMap`, `PasteSocialDialog`, `SocialImportsTray`.
- New `src/components/studio/FolderSwitcherDrawer.tsx` — Sheet/overlay containing the folder list (extracted from `StudioVault` or reused via the same component inside a Sheet).
- `src/components/studio/StudioWorkbench.tsx`:
  - Add hamburger `Menu` icon button (44px tap target) at the left of its header that opens `FolderSwitcherDrawer`.
  - Drop the now-unreachable "no activeFolder" empty-state block.

## Out of scope
- No changes to in-trip workspace `ProximityMap`.
- No DB / schema changes.
- Workbench internals (item creation, scrape, anchor, proximity sort) unchanged.
