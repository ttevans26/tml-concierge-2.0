## 1. Preview login — clarification (no code needed)

The login screen you hit in the Lovable preview is the real auth gate (`ProtectedRoute` → `/login`). It is fully built. Because the project runs in "Zero-Verification" mode, you don't need an emailed confirmation link:

- Go to `/signup`, enter any email + password → you're in immediately.
- Reuse those credentials on subsequent preview sessions.
- Optionally, I can seed a known dev account (e.g. `dev@tml.local` / a password you choose) so the team always has a shared login.

Nothing about this flow is broken — it just isn't obvious from the Lovable "Open preview" button. Tell me if you'd like the seeded dev account.

## 2. Slow navigation between spaces — root causes

After tracing the route lifecycle, three things compound on every nav:

1. **`AppLayout` remounts the whole page tree on every route change.**
   `src/components/AppLayout.tsx` sets `<main key={pathname}>`. Changing the `key` unmounts the previous page and mounts the next one from scratch — destroying React Query / Zustand-derived component state and re-running every `useEffect` (including fetches).
2. **Each page refetches on mount with weak guards.**
   `Index`, `Today`, `Tools`, `TripWorkspace` all call `fetchTrips()` / `fetchItineraryItems(id)` in `useEffect`. Guards like `trips.length === 0` only help the first time; on `TripWorkspace` the itinerary refetch fires for every visit to a trip, even one you opened 5 seconds ago.
3. **Lazy chunks + entry animation add perceived latency.**
   Every non-Index route is `lazy()`-loaded (good for first paint, bad on repeat nav with no prefetch), and `animate-editorial-in` plays a fresh fade on every mount because of the `key` reset.

Trip-detail navigation also pays a 4th cost: `MatrixGrid` and friends do their own initial work after the itinerary fetch resolves.

## 3. Plan of changes

### a. Stop remounting on every navigation
- `src/components/AppLayout.tsx`: remove `key={pathname}` on `<main>`. Keep the fade by scoping `animate-editorial-in` to a wrapper that mounts once, or trigger it only on first paint.

### b. Cache fetches so revisits are instant
- `src/stores/useTripStore.ts`: add lightweight freshness tracking
  - `tripsFetchedAt: number | null`
  - `itineraryFetchedAt: Record<tripId, number>`
  - `flightsFetchedAt: Record<tripId, number>`
  - `fetchTrips({ force? })`, `fetchItineraryItems(id, { force? })`, `fetchFlights(id, { force? })` short-circuit when `Date.now() - fetchedAt < 60_000` unless `force` is true.
- Update `Index`, `Today`, `Tools`, `TripWorkspace` to call the cached variants (no `force`). Realtime/mutations already update the store optimistically, so stale risk is minimal.
- Background revalidate: when a cached read is served, kick off a `force` fetch in the background so data stays warm without blocking the UI.

### c. Prefetch the likely next chunk
- `src/components/AppHeader.tsx` / `MobileBottomNav.tsx`: on `onMouseEnter` / `onFocus` of each nav link, call the matching `import()` (e.g. `import("@/pages/Studio")`) so the chunk is in cache before the click. Cheap, no behavioural change.

### d. Trim the trip-workspace cold path
- `src/pages/TripWorkspace.tsx`: when the user clicks a trip from `Index`, the trip object is already in `trips`. Set `activeTrip` synchronously from the cached array before any fetch so `MatrixGrid` can render its shell immediately. Only fetch itinerary items if the cache for that trip is stale.

### e. Verification
- Hard reload, sign in, then:
  - Click between Trips → Studio → Tools → Today twice each. Second pass should be effectively instant (no spinner, no fade-in delay, no network refetch in DevTools).
  - Open a trip from `/`, go back, reopen the same trip: itinerary should appear without a loading state.
- Watch the dev-server log + Network panel to confirm no duplicate `itinerary_items` requests within 60 s.

## 4. Out of scope (call out, don't do yet)
- Switching to React Query for global cache (bigger refactor; the freshness map above gets ~90% of the win).
- Eager-loading all routes (would hurt first paint).
- Skeleton polish per page (separate UX pass).

If this matches what you want, approve and I'll implement a–e in one pass.
