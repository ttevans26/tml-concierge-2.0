## Goal

Ship TML Concierge as a real iOS app (App Store-ready) so you can pull up your itinerary, Ideas Vault folders, and Tools page mid-trip — even without signal.

---

## Phase 1 — Capacitor shell

Wrap the existing React app with Capacitor so it runs natively on iOS without rewriting the UI.

1. Add Capacitor dependencies: `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`, `@capacitor/preferences` (secure storage), `@capacitor/network` (online/offline detection), `@capacitor/app` (lifecycle).
2. Create `capacitor.config.ts` with:
   - `appId: app.lovable.693f38f0fd12468791b16036a995ed65`
   - `appName: TML Concierge`
   - Hot-reload pointing at the Lovable sandbox URL so you can iterate in chat and see changes live on device.
3. Add a small `useIsNative()` hook (wraps `Capacitor.isNativePlatform()`) used by mobile-only UI tweaks (safe-area padding, hide desktop-only chrome).
4. Apply iOS safe-area insets globally (top notch + home indicator) so the App Shell header and bottom bars don't clip.

## Phase 2 — Offline data layer

The store currently fetches trips, itinerary items, studio folders, and studio items from Supabase on every mount. Add a persistent cache so they're available with zero signal.

1. **Persisted Zustand**: wrap `useTripStore` and `useStudioStore` with `zustand/middleware`'s `persist`, backed by Capacitor `Preferences` on native (falls back to `localStorage` on web). Caches: `trips`, `itineraryItems`, `studioFolders`, `studioItems`, `profile`, `loyalty/cards`.
2. **Stale-while-revalidate fetch pattern**: on app launch, hydrate UI immediately from cache, then fire Supabase queries in the background and reconcile.
3. **Network indicator**: small status pill in the header ("Offline — showing saved data") driven by `@capacitor/network`.
4. **Active trip pinning**: mark the active trip as "always cached" — its itinerary items, attached studio items, and any cached Place photos persist regardless of cache size.
5. **Mutation queue**: when offline, edits (drag/drop, edit dialog saves, marking items confirmed) go to a queued-write list; flushed to Supabase automatically when the network returns.

## Phase 3 — Mobile-first navigation

The current 3-panel desktop layout doesn't translate to a 390px phone. Add a native-feeling bottom tab bar for the four primary destinations:

```text
┌────────────────────────────┐
│       (current screen)     │
│                            │
├────────────────────────────┤
│ Today  Trip  Studio  Tools │
└────────────────────────────┘
```

- **Today** — new screen: next 24h of itinerary items + flight status, pulled from cached active trip.
- **Trip** — existing Matrix grid, switched to a vertical day-by-day stack on phone widths (already partly responsive; tighten it).
- **Studio** — Ideas Vault folders list → folder detail → item detail, all offline-readable.
- **Tools** — existing Tools page (Preparedness Checklist, Travel Warnings, Upcoming Appointments).
- Hide the bottom bar on desktop / web.

## Phase 4 — Native polish (small, high-impact)

- Splash screen + app icon set generated from the Bronze Beige + Onyx mark.
- Status bar style synced to Cream/Onyx theme.
- Tap any itinerary item with a `google_place_id` → opens Apple Maps natively.
- `@capacitor/app` listener triggers a background refresh whenever the app returns to the foreground.

## Phase 5 — Run it on your phone

After the shell is wired up I'll give you the exact 6-step recipe:
1. Push the project to your GitHub via Export.
2. `git clone` + `npm install` locally on a Mac.
3. `npx cap add ios`
4. `npm run build && npx cap sync`
5. `npx cap open ios` to open Xcode.
6. Plug in your iPhone, sign with your Apple ID, and press Run.

---

## Technical notes

- **Auth**: Supabase JWT already persists in `localStorage`; Capacitor's WebView treats it like Safari, so existing sessions survive app restarts. No changes needed beyond ensuring tokens auto-refresh on resume.
- **Edge functions**: All current edge functions (`smart-pull`, `concierge-chat`, `aviationstack-lookup`, `scrape-and-parse`) keep working unchanged — they're just HTTP calls.
- **Google Maps JS API**: Stays on web view, no native SDK swap needed for v1.
- **Push notifications, Wallet passes, share-sheet ingestion**: explicitly deferred to a Phase 6 — they require Apple Developer Program enrollment and APNs setup, which we should tackle after the shell feels good on-device.
- **App Store submission**: not part of this build; once you've TestFlight'd it for a few days we'll add the listing assets.

---

## What this plan does NOT do

- No rewrite to SwiftUI — staying with React + Capacitor keeps one codebase.
- No PWA / service worker (Capacitor handles the native shell instead).
- No push notifications in v1 (needs paid Apple Developer account first).
