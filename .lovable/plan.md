## Editorial Restage — Quiet Luxury v2

Keeps the existing palette (Cream / Onyx / Bronze) but adds dimension through layered elevation, paper grain, foil accents, larger display type, and motion. Three reference components from 21st.dev get integrated into Concierge, Studio, and the Public share view.

**Revert:** no theme flag. If you don't like it, click the revert button on the implementation message or use the History tab to jump back. All changes will land in one logical batch so reverting is a single click.

---

### 1. Token & primitive layer (the foundation)

`src/index.css` + `tailwind.config.ts`:

- **Surface tiers** — add `--surface-1` (cream base), `--surface-2` (raised cards), `--surface-3` (popovers/modals), each a half-step warmer/cooler than today's flat `--card`.
- **Elevation tokens** — `--shadow-paper`, `--shadow-raised`, `--shadow-float`, `--shadow-foil`. Soft, warm, multi-layer (no harsh black drop-shadows).
- **Bronze gradient tokens** — `--gradient-foil` (bronze 38% → 52% diagonal), `--gradient-foil-soft` for badges/CTAs, `--gradient-ink` (onyx → 18% black) for headings.
- **Grain texture** — `--texture-grain` as an inline SVG noise data-URL applied at `opacity:.035` on `body::before` and `.surface-grain` utility.
- **Radii** — keep 2px default, but introduce `--radius-md: 4px` for hero cards / map / Concierge bubble so depth reads correctly.
- **Hairline borders** — preserve 0.5px, add `--border-foil` (bronze at 30% opacity) for hover/active states.
- **Type scale** — extend Playfair: `display-xl 72/68`, `display-lg 56/56`, `display-md 40/44`, plus an `italic-accent` class (Playfair italic, +1 tracking) for the "Urge" logotype mood. Inter scale unchanged.
- **Motion tokens** — `--ease-editorial: cubic-bezier(.2,.8,.2,1)`, `--dur-quick 180ms`, `--dur-soft 320ms`, `--dur-page 480ms`.

All values added to `tailwind.config.ts` so they're usable as `bg-surface-2`, `shadow-paper`, `font-display-lg`, `ease-editorial`, etc. No raw hex in components.

---

### 2. Chrome restage

- **`AppHeader`** — taller (72px), bronze hairline under, italic Playfair wordmark, foil hover on nav links.
- **`AppLayout`** — body gets the grain layer + a faint top vignette.
- **Buttons (`ui/button`)** — new `premium` variant (foil gradient, soft shadow, magnetic 1px lift on hover); `ghost` keeps current look; `outline` gains bronze hairline.
- **Cards (`ui/card` + workspace cards)** — `surface-2`, `shadow-paper`, hover lifts to `shadow-raised` over 180ms.
- **Dialogs / popovers / sheets** — `surface-3`, `shadow-float`, `radius-md`, backdrop warms to cream-tinted blur instead of neutral black.

---

### 3. Page-level editorial restage

- **`Index.tsx` (dashboard)** — display-xl Playfair hero ("Your Studio"), italic accent on a single word, trip cards become magazine tiles with cover photo, day count, and bronze foil meta strip. Empty state becomes a centered editorial moment.
- **`TripWorkspace.tsx`** — header shows trip name in display-md, dates in italic-accent, bronze hairline under. Left/center/right panels get distinct surface tiers so the depth reads.
- **`Studio.tsx`** — left sidebar `surface-1`, workbench `surface-2`, right rail `surface-2`. **Default workbench (no folder selected) becomes the arc map** (see §4).
- **`Today.tsx`** — "Day X of Y" gets a Playfair treatment; "Next Up" hero card uses foil border and place photo background.
- **`PublicTripView.tsx`** — top of page becomes a full-bleed arc map hero with the trip wordmark overlaid (see §4).
- **`Login` / `Signup` / `ForgotPassword`** — split-screen editorial: large Playfair quote left, form right on `surface-2`.

---

### 4. New component integrations

**A. Animated AI chat → `ConciergePanel.tsx`**
Replace the current textarea + send button with the 21st.dev animated chat input (`https://21st.dev/community/components/jatin-yadav05/animated-ai-chat/default`). Keep all existing wiring: same submit handler, same `tool_calls` rendering above, same `ConciergeToolCard`. Component file: `src/components/ui/animated-ai-chat.tsx`. Style overrides to bind it to our tokens (cream surface, bronze accent ring, Playfair placeholder).

**B. Marker popup → Matrix + Studio cards**
Wrap `ItineraryItemCard` and Studio research-item cards in a `MarkerPopupHover` (from `https://21st.dev/community/components/mapcn/mapcn-marker-popup/default`). Triggers on hover/focus for any card with `google_place_id`, showing place photo, rating, address, and a "Open in Maps" affordance. Component file: `src/components/ui/marker-popup.tsx`. Lazy — only mounts on first hover.

**C. Map arc → Public share view hero + Studio default**
Use the arc map (`https://21st.dev/community/components/mapcn/mapcn-map-arc/default`) in two places:
- **`PublicTripView.tsx`** — full-bleed hero, arcs drawn between each day's anchor stay and that day's first activity. Trip title overlaid in Playfair display-xl.
- **`Studio.tsx`** — when no folder is selected (current empty state), the workbench renders the arc map plotting all `sites_of_interest` and Stay anchors for the active trip. Clicking a folder swaps it out for the normal list view.
Component file: `src/components/ui/map-arc.tsx`. Needs Mapbox or MapLibre token — we'll reuse the existing Google Maps key path if the component supports it; otherwise add a `MAPBOX_TOKEN` secret (will prompt if required).

---

### 5. Motion polish

- Page transitions: `fade-in` + 4px translate on route change (480ms `ease-editorial`).
- Card hover: 1px lift + shadow swap.
- CTA "magnetic" hover on `premium` buttons (subtle cursor-follow within 8px).
- Concierge messages: stagger-in (60ms per message).
- Matrix cell drop: brief foil flash on the destination cell.

All motion respects `prefers-reduced-motion`.

---

### 6. Files touched

**New:**
- `src/components/ui/animated-ai-chat.tsx`
- `src/components/ui/marker-popup.tsx`
- `src/components/ui/map-arc.tsx`
- `src/styles/grain.svg` (or inline data-URL in CSS)

**Edited (tokens / chrome):**
- `src/index.css`, `tailwind.config.ts`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/popover.tsx`, `src/components/AppHeader.tsx`, `src/components/AppLayout.tsx`, `index.html` (font preload + display sizes).

**Edited (pages):**
- `src/pages/Index.tsx`, `src/pages/TripWorkspace.tsx`, `src/pages/Studio.tsx`, `src/pages/Today.tsx`, `src/pages/PublicTripView.tsx`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/pages/ForgotPassword.tsx`.

**Edited (workspace):**
- `src/components/workspace/ConciergePanel.tsx`, `src/components/workspace/ItineraryItemCard.tsx`, `src/components/workspace/MatrixGrid.tsx`, `src/components/workspace/BudgetSidebar.tsx`, `src/components/workspace/TripSwitcher.tsx`, `src/components/studio/*` (research card + sidebar).

**No DB migrations. No store changes. No behavior changes** — purely visual + the three component swaps.

---

### 7. Out of scope

- Mobile breakpoints (postponed per earlier decision).
- Dark mode polish (will inherit token changes but won't be hand-tuned).
- New illustrations / photography.
- A persistent theme toggle — revert via History instead.

---

### Open question I'll resolve during build

The 21st.dev arc map requires a map provider. I'll first try wiring it to the existing Google Maps key. If the component is Mapbox-only, I'll pause and request a `MAPBOX_TOKEN` secret before continuing — no silent fallback.
