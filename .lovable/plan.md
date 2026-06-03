## Goal

Make every interaction feel instant. Profiling on `/` shows 1.5 MB JS up-front (195 script chunks), 3.9 s DOMContentLoaded, and the largest user-land modules (StudioWorkbench 41 KB, TripDocuments 16 KB, MatrixGrid 28 KB, GeminiFooter 24 KB) are loaded even when not used. Several hot components also subscribe to the **entire** Zustand store, so any unrelated update re-renders huge trees.

## Fix plan (frontend only — no behavior changes)

### 1. Lazy-load all non-critical routes (`src/App.tsx`)

Currently every page is a static import, so Studio/Tools/Network/Today/Trip/Public bundles ship on first load of `/`. Convert to `React.lazy` + `<Suspense>` with a lightweight fallback. Keep `Login`, `Signup`, `ProtectedRoute`, `AppLayout`, and `Index` eager so the landing path stays fast. Expected: ~40–60% smaller initial JS, FCP closer to 1.5 s.

### 2. Scope global store subscriptions

Replace bare `useTripStore()` (re-renders on any state change) with field selectors in:
- `src/pages/TripWorkspace.tsx` (line 23 — currently subscribes to whole store while just bootstrapping)
- `src/pages/Today.tsx` (uses 4 fields — split into 4 selectors)
- `src/pages/Index.tsx` (3 fields)
- `src/components/workspace/IdeasVault.tsx` (`activeTrip` only)

Result: typing in a dialog or moving a card no longer re-renders unrelated pages.

### 3. Memoize hot workspace components

- `src/components/workspace/MatrixGrid.tsx` — wrap day-cell + item-card render in `useMemo` keyed on `(items, dragState)`; wrap `ItineraryItemCard` with `React.memo`. Move date-range computation behind `useMemo`. Replace inline `() => …` handlers passed to many cells with stable `useCallback`s.
- `src/components/workspace/ItineraryItemCard.tsx` — `React.memo` with shallow prop compare; pre-format currency/time once.
- `src/components/workspace/BudgetSidebar.tsx` — already uses selectors; add `useMemo` for the formatted progress strings.
- `src/components/workspace/ProximityMap.tsx` — memoize the haversine/sorted list; gate the heavy SVG render behind `useDeferredValue` so dragging on the Matrix doesn't stall the map.
- `src/components/studio/StudioWorkbench.tsx` — split into the top toolbar (eager) and the list/map (lazy via `React.lazy`); memoize list filtering.

### 4. Defer heavy non-critical UI

- `GeminiFooter.tsx` — keep the trigger button eager but `React.lazy` the chat panel (loads `AnimatedAIChat`, `react-markdown` ~70 KB) only after the user opens it.
- `TripDocuments.tsx`, `SmartPullInbox.tsx`, `PackingList.tsx`, `ShareControls.tsx`, `TripSettingsModal.tsx`, `EditItemDialog.tsx`, `AddItemDialog.tsx` — convert to `React.lazy` and mount on first open (same pattern already applied to `SchedulingModal`/`ProfileDrawer`).
- `react-day-picker` (106 KB) — already isolated via lazy SchedulingModal; audit any remaining eager calendar usage in `EditTripDialog`/`TripSettingsModal` and lazy-load those too.

### 5. Reduce render-blocking + asset cost

- Add `rel="preconnect"` for `fonts.gstatic.com` in `index.html` alongside existing fonts link to cut TTF latency.
- Confirm Tailwind/Vite is tree-shaking `lucide-react` (157 KB dev chunk). Replace any `import * as Icons from "lucide-react"` style imports with named imports.
- Audit `NotificationsPopover` realtime subscription is created once at idle (already done) — extend the same `requestIdleCallback` pattern to `useTripStore.fetchTrips` initial call on `Index`.

### 6. Verify

After each batch, run `browser--performance_profile` on `/` and `/trip/:id`, then `start_profiling` → interact (drag a card, open Concierge, open profile) → `stop_profiling`. Target: INP < 100 ms on all primary interactions, initial JS payload under ~800 KB on `/`.

## Out of scope

No backend, schema, or business-logic changes. No design refactors. Component APIs preserved.

## Risk / rollback

All changes are local to listed files. Each step is independently revertable via History. Lazy-loaded chunks fall back to a small spinner; if a Suspense boundary triggers a visible flash, swap to `startTransition` for that route.
