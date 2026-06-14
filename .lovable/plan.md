
## Goal

On iOS / mobile, replace the current single-panel Studio view (workbench list only, no map) with a Google-Maps-style stack:

1. Full-bleed `StudioMap` filling most of the screen
2. A floating **"Find a Place"** search bar pinned over the top of the map
3. A draggable **bottom sheet** with the saved places, grouped by category, horizontally scrollable photo cards (like the screenshot — name, rating, address chips, image strip)
4. Works in both the "no folder" Design Lab state and the "active folder" state

Desktop layout is unchanged.

## Changes

### 1. New component: `src/components/studio/StudioMobileView.tsx`

A mobile-only surface that composes three layers:

- **Map layer** — re-uses `<StudioMap />` as a full-height background. Its existing header (`Proximity Map` title) gets hidden when rendered inside this view (add an optional `bare?: boolean` prop to `StudioMap` that drops the header chrome and the bottom "Missing Coordinates" panel so the map fills the area).
- **Search overlay (top)** — a floating pill at the top with:
  - hamburger button → opens `FolderSwitcherDrawer` (re-used)
  - "Find a place" input → re-uses the same `useGooglePlaces` hook + selection / add flow already in `StudioWorkbench` (factored into a small shared helper `addPlaceFromPrediction` in a new `src/components/studio/lib/addPlace.ts` so both Workbench and the mobile view can call it)
  - paste social link icon button → opens `PasteSocialDialog`
- **Bottom sheet** — uses existing `@/components/ui/drawer` (vaul) in a controlled, always-mounted, snap-pointed mode:
  - Two snap points: peek (~28% of viewport, shows handle + first category row) and expanded (~80%)
  - Content: the saved-places list grouped by category (Stays / Dining / Activities / Sites), each item rendered as a Google-Maps-style row:
    - Title (Playfair), rating + reviews count, address chip, category icon
    - Below the row, a horizontal-scroll strip of photos (`api_metadata.photo_url` + any additional photo URLs already stored)
    - Tap row → pans the map to the item and opens its info window (expose a small imperative API from `StudioMap` via `forwardRef`: `panTo(itemId)` — or simpler: lift selection state into a Zustand slot `selectedItemId` and have `StudioMap` react to it)
  - Empty state (no active folder): sheet shows "Open a collection" CTA + the `StudioVault` list inline so the user can pick a folder without leaving the map.

### 2. `src/components/studio/StudioMap.tsx`

- Add `bare?: boolean` prop. When true: skip the header, skip the bottom Missing-Coordinates strip, and let the map div fill 100%.
- Add `onSelectItem?: (item) => void` callback fired from marker click (in addition to opening the info window) so the bottom sheet can sync.
- Keep all current desktop behavior unchanged.

### 3. `src/pages/Studio.tsx`

- Import `useIsMobile` from `@/hooks/use-mobile`.
- If mobile: render `<StudioMobileView />` (covers both no-folder and active-folder cases — the bottom sheet adapts).
- If desktop: keep the existing branching exactly as today.

### 4. `src/components/studio/StudioWorkbench.tsx` (minor)

- Extract the "Find a Place" add logic (`handleAddPlace` + `handleSelectPrediction`) into a small shared util used by both Workbench and the new mobile view. No behavior change for desktop.

### 5. No backend, schema, or RLS changes.

## Out of scope

- Desktop Studio layout
- Trip workspace `ProximityMap` (different component)
- Replacing existing `StudioMap` styling/markers
- Re-introducing the static iOS trip map work (already shipped)

## Files touched

- New: `src/components/studio/StudioMobileView.tsx`
- New: `src/components/studio/lib/addPlace.ts`
- Edit: `src/components/studio/StudioMap.tsx` (add `bare` + `onSelectItem` props)
- Edit: `src/pages/Studio.tsx` (mobile branch)
- Edit: `src/components/studio/StudioWorkbench.tsx` (use shared helper)
