## Scope: Tier 1 (iOS) + Tier 2 (desktop gaps)

Executed in two focused passes so you can test iOS on device between them.

---

### Pass A — iOS / mobile (ship first)

1. **iOS PWA polish**
   - Add `apple-mobile-web-app-status-bar-style=black-translucent`, `viewport-fit=cover`, lock manifest `id` + `scope`.
   - Generate Apple splash screens (common iPhone sizes) from the existing globe master via ImageMagick; wire `<link rel="apple-touch-startup-image">` tags in `index.html`.
   - Audit safe-area insets (`env(safe-area-inset-*)`) in `AppHeader`, `MobileBottomNav`, `TripWorkspace` Sheets, Concierge/Budget drawers.

2. **Mobile workspace UX**
   - `MatrixGrid`: sticky day-header row on mobile, horizontal scroll-snap on day columns, larger tap targets in cells.
   - Bottom Sheets (`TripWorkspace` left/right drawers): swipe-down dismiss, prevent body scroll lock issues.
   - 44px min tap-target sweep across Smart Cards, Studio rows, header icon buttons.

3. **iOS input hardening**
   - Add `inputMode`, `autoComplete`, `enterKeyHint` on Login/Signup/ForgotPassword forms, `CreateTripDialog`, `AddItemDialog`, `EditItemDialog`.
   - Fix iOS Safari keyboard-overlay clipping on `ConciergePanel` and Add Item sheets (`100dvh` + keyboard-aware padding).
   - Disable iOS double-tap zoom on icon buttons (`touch-action: manipulation`).

4. **Capacitor sanity check (config only, no native build)**
   - Verify `capacitor.config.ts`, add `@capacitor/status-bar` + `@capacitor/splash-screen` config if missing, confirm `apple-app-site-association` matches Universal Links.
   - Update README with the exact `npm i → npx cap add ios → npx cap sync → open ios/App` steps you'll run on your Mac.

---

### Pass B — Desktop functional gaps

5. **Public view + share redaction (DB-enforced)**
   - Confirm/create `itinerary_items_public` view (strips `cost`, `confirmation_code`, `points_used` if treated as financial).
   - Re-point `PublicTripView` + `ReadOnlyMatrixGrid` to read from the view, not the base table.
   - Add RLS policy review for `trips.is_published`.

6. **Trip access requests — close the loop**
   - Verify `RequestAccessModal` → `trip_access_requests` insert → owner sees in `NotificationsPopover` → approve/deny grants/denies read access.
   - Patch any missing piece (most likely owner-side approve action + access-grant policy).

7. **Splurge Engine / Budget Reserve audit**
   - `useTripStore` selectors: separate cash vs points totals, FX-normalize via `fetch-fx-rates`, reconcile per-day totals against Matrix daily sums.
   - Surface a small "Math check" debug line in dev to validate reconciliation.

8. **Concierge proposal → Matrix commit**
   - Wire `ProposalCard` accept → creates `itinerary_items` with date/category/loyalty metadata, optimistic insert into `useTripStore`.

9. **Edge function error UX**
   - Standard toast + retry on `aviationstack-lookup`, `scrape-and-parse`, `ingest-social-post`, `smart-pull` failures via a shared `invokeWithRetry` helper in `src/services/`.

---

### Out of scope for this run

- Building the actual iOS IPA (requires your Mac + Xcode).
- New features beyond gap-closing.
- Tier 3 stretch items (onboarding empty states, loyalty multiplier audit) — pick up only if credits remain.

### Order of operations

Pass A first → tell you to test on iPhone → Pass B. If anything in Pass A reveals a deeper issue, I'll stop and surface it before spending more credits.
