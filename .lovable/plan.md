## Goal

When no folder is selected in Studio, the center display should not show the atlas map. Instead, the **right-side Proximity Map** should show a slowly rotating globe (a "world view" loop) since the destination/context is undefined.

## Changes

### 1. `src/components/studio/StudioWorkbench.tsx` — remove center atlas
In the `!activeFolder` branch (lines ~430–483):
- Remove the `<MapArc points={allPoints} height={420} />` render and the `allPoints` aggregation block.
- Remove the `MapArc` / `ArcPoint` import.
- Keep the editorial intro copy ("Design Lab / The atlas of your ideas"), the Paste Social Link button, and `SocialImportsTray`.
- Replace the copy line ("Every saved place plotted on a single canvas…") with a shorter prompt directing the user to pick a collection from the vault on the left, hinting the globe on the right is awaiting a destination.

### 2. `src/components/ui/map-arc.tsx` — add rotating globe mode
Add an optional prop `mode?: "arc" | "globe"` (default `"arc"` — non-breaking). When `mode === "globe"`:
- Render a centered circular SVG "globe" with:
  - Cream sphere fill + bronze hairline equator and 2 latitude rings.
  - 6 longitude meridians as ellipses.
  - A subtle radial highlight (top-left) and bronze rim shadow for dimension.
- Wrap the meridian/lat group in a `<g>` whose CSS transforms apply `rotate-y` via a 24s linear keyframe animation (`globe-spin`) — pure SVG `transform: rotateY` won't render in all browsers, so simulate rotation by animating the meridian ellipses' `rx` between `R` and `~0.2R` with phase-offset delays, producing a believable rotating-wireframe globe.
- Keep grain + vignette overlay for paper feel.
- Honor `prefers-reduced-motion` (pause animation).
- Title/subtitle slot still respected if provided.

### 3. `src/components/studio/StudioMap.tsx` — show globe in the empty state
In the `!activeFolder` branch (currently the "World View" Compass placeholder, lines ~189–200):
- Replace the placeholder block with `<MapArc mode="globe" points={[]} height={undefined} className="flex-1 rounded-none border-0 shadow-none" />` filling the panel.
- Below the globe (still inside the panel), keep a small editorial caption: small uppercase eyebrow "World View" + Playfair line "Awaiting a destination" + 1-line muted helper "Choose a collection from the vault to focus the atlas."
- When a folder IS selected, behavior is unchanged (Google Map renders as today).

### Scope / non-goals
- No changes to data, store, routes, or the Trip Workspace's `ProximityMap`.
- No tile-provider integration; the globe is decorative SVG only.
- Reverts cleanly via History.

## Files touched
- `src/components/ui/map-arc.tsx` (add `globe` mode)
- `src/components/studio/StudioWorkbench.tsx` (remove center atlas, tighten copy)
- `src/components/studio/StudioMap.tsx` (render rotating globe in empty state)
