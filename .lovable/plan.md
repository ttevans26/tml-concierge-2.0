
## Goal

Make the app feel native on an iPhone (393×852 — iPhone 15 reference) and make it installable to the home screen via PWA manifest. No App Store, no service worker, no offline mode — pure local install/test path. Capacitor live-reload config already exists, so the same build also runs in an iOS simulator via `npx cap run ios`.

## Scope

In:
1. Mobile-first layout refinements on the Trip Workspace + global shell
2. Hamburger drawer for Studio (left) and Budget/Concierge/Map/Pack/Docs (right) on mobile
3. Thumb-friendly tap targets (≥44px) across primary controls
4. Manifest-only PWA (installable, no service worker, no offline)
5. Apple touch icon + favicons + theme color for standalone install

Out:
- Service worker / offline caching (explicitly excluded per PWA skill — user didn't ask for offline)
- Publishing or App Store submission
- Redesigning desktop layout (mobile only)

## 1. Mobile Trip Workspace (TripWorkspace.tsx)

Today: 3-column desktop layout with left Studio sidebar, center MatrixGrid, right Budget panel. On mobile (<lg) both sidebars are hidden entirely and only MatrixGrid shows.

Changes:
- Add a top-bar hamburger (left) that opens a `<Sheet side="left">` containing `<StudioSidebar />`
- Add a top-bar panel icon (right) that opens a `<Sheet side="right">` containing the 5-tab panel (Budget / Concierge / Map / Pack / Docs) — same tabs as desktop, full-height sheet
- Hide the existing collapsed-rail strips on mobile (they're desktop-only already)
- MatrixGrid takes full viewport width on mobile
- Header buttons sized to `h-11 w-11` (44px) on mobile

## 2. MatrixGrid mobile tuning

- Already horizontally scrollable — keep that
- Increase day-column min-width on mobile for easier tap targets on smart cards
- Ensure the "+ add" buttons in empty cells are min 44×44px on mobile
- Pulse strip already responsive — leave as-is

## 3. Thumb-friendly targets globally

Audit + bump these to min-h-11 (44px) on mobile:
- TripHealthBar action chips
- TripSwitcher dropdown trigger
- MobileBottomNav already 56px — good
- Smart card primary actions (edit/delete) — increase hit area without changing visual size via padding

## 4. PWA — manifest only (no service worker)

Per the PWA skill, for "installable / add to home screen / app icon" requests use **manifest-only**. Do NOT add `vite-plugin-pwa`, `workbox`, or a service worker.

Files to add:
- `public/manifest.webmanifest` — name, short_name, theme_color `#FDFCF8`, background_color `#FDFCF8`, display `standalone`, orientation `portrait`, scope `/`, start_url `/`, icons array (192, 512, 512 maskable)
- `public/icon-192.png` — generated via imagegen (TML monogram on cream)
- `public/icon-512.png` — same, larger
- `public/icon-512-maskable.png` — with safe-area padding for Android adaptive icons
- `public/apple-touch-icon.png` — 180×180, no transparency (iOS requirement)

`index.html` additions in `<head>`:
- `<link rel="manifest" href="/manifest.webmanifest">`
- `<meta name="theme-color" content="#FDFCF8">`
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- `<meta name="apple-mobile-web-app-title" content="TML">`
- Keep existing viewport meta; add `viewport-fit=cover` so safe-area insets work in standalone

No registration code, no `sw.js`, no version polling — installability comes from the manifest + icons alone.

## 5. Capacitor iOS local-test path (documentation only — no code changes)

`capacitor.config.ts` already exists with appId/appName and live-reload env switch. To actually run on a local iOS simulator the user will need to:
1. Export to GitHub → clone locally
2. `npm install`
3. `npx cap add ios`
4. `npm run build && npx cap sync ios`
5. `npx cap run ios` (requires Xcode)

I'll include this as a short note in the final summary, not as a code change — the sandbox cannot run Xcode.

## Technical details

```text
TripWorkspace mobile layout
┌─────────────────────────────────┐
│ ☰  Trip Switcher          ⚙  ▣ │  <- hamburger, edit, panel
├─────────────────────────────────┤
│ TripHealthBar (chips wrap)      │
├─────────────────────────────────┤
│                                 │
│   MatrixGrid (horizontal scroll)│
│                                 │
├─────────────────────────────────┤
│ Today · Trips · Studio · Tools  │  <- existing MobileBottomNav
└─────────────────────────────────┘
```

Files touched:
- `src/pages/TripWorkspace.tsx` — add Sheet-based mobile triggers, conditional rendering via `useIsMobile`
- `src/components/workspace/MatrixGrid.tsx` — tap-target padding on mobile
- `index.html` — PWA head tags
- `public/manifest.webmanifest` — new
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png`, `public/apple-touch-icon.png` — generated

## Out of scope confirmations

- No service worker, no `vite-plugin-pwa`
- No offline support
- No desktop layout changes
- No backend changes
