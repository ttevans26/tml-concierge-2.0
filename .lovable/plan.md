Three separate issues bundled in your message. Tackling them in order:

## 1. Sign-out doesn't reach `/login` (carries over from previous turn)

`signOut()` works, but on the preview host `ProtectedRoute` and `Login` immediately re-invoke `ensureDevSession()` and sign the shared dev account back in. Fix:

- **`src/lib/devAutoAuth.ts`** — add `suppressDevAutoAuth()` / `isDevAutoAuthSuppressed()` / `clearDevAutoAuthSuppression()` backed by `sessionStorage`. `ensureDevSession()` short-circuits to `false` when suppressed.
- **`src/hooks/useAuth.tsx`** — call `suppressDevAutoAuth()` before `supabase.auth.signOut()`.
- **`src/components/ProfileDrawer.tsx`** — after `handleSignOut` and `signOutAllDevices` hard-navigate with `window.location.href = "/login"` so route state fully resets.
- **`src/pages/Login.tsx`** + **`src/pages/Signup.tsx`** — skip the auto-bypass `useEffect` when `isDevAutoAuthSuppressed()`; call `clearDevAutoAuthSuppression()` on successful sign-in so future visits auto-bypass again.

## 2. Trip map shows Africa

Root cause: the Europe 2026 trip's `destination` is the string `"UK, France, Italy"`. When geocoded as a `fallbackQuery`, Google returns a centroid in the Atlantic / Africa (lat 20, lng 0 region). Two things compound it:

- `TripRouteMap` opens with `center: { lat: 20, lng: 0 }` (mid-Africa) before geocoding resolves — visible as a flash even when waypoints later succeed.
- `Index.tsx` passes the multi-country destination string straight through to the geocoder when waypoint building returns empty.

Fix in two places:

- **`src/components/trips/TripRouteMap.tsx`** — change the initial map center to the first waypoint when available, otherwise leave the container in the `"loading"` state instead of mounting a map centered on `0,0`. Don't render the map until we have either a waypoint or a successful geocode.
- **`src/lib/tripRoute.ts`** — when geocoding a stay fails, try the stay's `location_name` (which for Europe 2026 holds proper city strings like "Saint-Rémy-de-Provence") before falling back to the trip destination. Reject geocode results whose viewport spans more than ~one country (heuristic: bounds wider than 15° in either axis) so a multi-country fallback string can't return a bogus centroid.
- **`src/pages/Index.tsx`** — when the trip destination contains more than one comma-separated region (e.g. `"UK, France, Italy"`), don't pass it as `fallbackQuery`; rely on the per-stay geocoding inside `buildRouteWithGeocoding`.

After this, Europe 2026 will render Paris → St Rémy → Antibes → Ortisei → Salò → Bath → Sherborne (driven by `ROUTE_HINTS` already in `tripRoute.ts`).

## 3. Matrix Grid layout change — needs your input before I touch the code

You wrote:
> still showing the old format with horizontal color bands by data type and not by locations in a vertical fashion and not showing the locations in pill multi date spanning form

`MatrixGrid.tsx` is 1,498 lines and the current row model is **rows = categories (Stays / Logistics / Dining / Agenda)** across **columns = dates**. Reworking it to "rows = locations" with multi-day "pills" is a significant feature change, not a bug fix, and I want to confirm the intent before I rewrite it. After you approve items 1 and 2, I'll come back with a focused plan + visual mock for the Matrix redesign so we get the structure right (rows by location? location pills as a header track over the existing category rows? something else?).

---

Approve and I'll ship items 1 and 2 in build mode, then return with options for the Matrix redesign.