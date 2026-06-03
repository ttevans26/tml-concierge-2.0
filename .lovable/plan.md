# Remaining Roadmap — Ranked for iOS Plug-In Readiness

Goal: every item below either (a) removes a blocker that would force a rewrite once we wrap in Capacitor / submit to the App Store, or (b) is deferrable until after the iOS shell is live. Ranking is by **iOS impact × user-visible risk × effort to retrofit later**.

---

## Tier 1 — Must ship before the iOS build (blockers)

### 1. A1 — Auth Hardening (Apple Sign-In + email confirm + session model)
**Why first:** Apple **requires** "Sign in with Apple" on any App Store app that offers third-party social login (we have Google). Retrofitting auth after launch invalidates existing sessions and breaks deep links. Also unlocks production-grade email confirm, which today is bypassed.
- Enable `apple` provider via `configure_social_auth(["google","apple"])`, keep email.
- Flip `auto_confirm_email=false` behind a `VITE_REQUIRE_EMAIL_CONFIRM` flag so dev/sandbox stays frictionless.
- Cache `authUserId` in `useTripStore` on first resolve + `onAuthStateChange` (already noted as A2 follow-up). Removes a `supabase.auth.getUser()` round-trip per mutation — critical over cellular.
- Add Capacitor-safe deep-link redirect handling (`app.lovable...://auth/callback`) in `useAuth.tsx`.
- HIBP password check on (`password_hibp_enabled=true`).

### 2. Service-Layer Adoption (finish A4)
**Why:** This is the seam that lets us swap Supabase JS for a Capacitor-native bridge or offline cache later without touching components. Today only `NotificationsPopover` is migrated.
- Migrate call sites in order: `useTripStore` (13) → `useStudioStore` (5) → `PackingList`, `TripDocuments`, `ConciergePanel`, `SocialImportsTray`.
- Add ESLint rule forbidding `@/integrations/supabase/client` imports outside `src/services/` + `src/integrations/`.
- Outcome: a single place to add retry/offline/queue logic for mobile.

### 3. Offline + Network Resilience Pass
**Why:** Mobile networks drop. Without this, drag-and-drop on the Matrix corrupts state on flaky Wi-Fi.
- Wrap every service write in a retry-with-backoff helper (lives in `src/services/_http.ts`).
- Add `@tanstack/react-query` for read caching (we have it in deps — adopt for trips/items list, falls back to cache when offline).
- Persist `useTripStore` slices (active trip + last 50 items) via the existing `lib/persistStorage.ts`.
- Show the existing `OfflineIndicator` based on `navigator.onLine` + a service-layer `lastError` flag.

### 4. Edge Function Discipline — finish A3 rollout
**Why:** Today only 2 of 9 functions use the `_shared/handler.ts` wrapper. Inconsistent CORS / error envelopes will manifest as silent failures inside the Capacitor WebView (stricter cookie + origin rules).
- Migrate: `concierge-chat`, `scrape-and-parse`, `smart-pull`, `smart-pull-gmail`, `get-concierge-suggestions`, `cancellation-scan`, `fetch-fx-rates`, `delete-account`.
- Add `x-client: ios|web` header from the service layer for per-platform rate-limit tuning.

---

## Tier 2 — Ship with or right after the iOS shell

### 5. Capacitor Native Wrapper (the "plug-in" itself)
Depends on Tier 1.
- `bun add @capacitor/ios @capacitor/splash-screen @capacitor/status-bar @capacitor/push-notifications @capacitor/preferences @capacitor/share @capacitor/app`.
- `capacitor.config.ts` already correctly defaults to bundled `dist/` (good).
- Wire `@capacitor/preferences` as the storage adapter behind `lib/persistStorage.ts` so the same code paths work on web + native.
- Replace `localStorage` Supabase auth storage with a Capacitor-aware adapter (Keychain on iOS via `@capacitor-community/secure-storage` or `Preferences` w/ note).
- Add `safe-area` CSS vars to `AppLayout` (notch + home indicator).
- Push notifications stub → wire to `notifications` table on receipt.

### 6. A6 — Route-level Error Boundaries + native crash plumbing
- Per-route `<AppErrorBoundary>` on `/trip/:id`, `/studio`, `/network`.
- Swap `lib/observability/sentry.ts` for `@sentry/capacitor` inside the same shim (zero call-site changes).

### 7. A5 — Activate Sentry + PostHog
- Add `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` secrets.
- `bun add @sentry/react posthog-js` (and `@sentry/capacitor` for native build).
- Already no-op safe today; activation is one PR.

---

## Tier 3 — Post-launch polish (do not block iOS)

### 8. A7 — i18n adoption + a11y pass
- Scaffold exists (`src/i18n/`). Migrate strings in `AppErrorBoundary`, nav, common dialogs. Ship `es.json` lazily.
- axe/Lighthouse pass on Matrix Grid + Studio; validate 0.5px borders against WCAG AA contrast at small sizes (likely the only failure).
- `aria-live` regions for Matrix drag feedback + toast queue.

### 9. A8 — Branch protection + Lighthouse gating
- CI workflow exists. Required GitHub settings: add `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID` secrets, install Renovate (disable Dependabot), require `verify` check on `main`. **One-time GitHub admin task, no code.**

### 10. Phase B niceties
- Real cursor pagination UI (current 500-row soft cap is enough for MVP).
- Backend-backed rate limits (Postgres `rate_limits` table) replacing in-isolate buckets.

---

## Recommended sequencing

```text
Week 1  ┃ #1 Auth hardening (Apple + deep links + cached uid)
Week 1  ┃ #2 Service-layer migration (parallelizable; one store per PR)
Week 2  ┃ #3 Offline + react-query + persist
Week 2  ┃ #4 Edge function rollout (mechanical, parallelizable)
        ┃── iOS-ready checkpoint ──
Week 3  ┃ #5 Capacitor wrapper + Keychain auth + safe areas
Week 3  ┃ #6 Route boundaries + @sentry/capacitor
Week 4  ┃ #7 Activate Sentry/PostHog with live keys
Post    ┃ #8 i18n + a11y, #9 CI gating, #10 Phase B
```

---

## Decision needed from you

Pick **one** to start the next build turn:

- **A — Auth hardening (#1)**: highest iOS-blocker risk; biggest single unlock.
- **B — Service-layer migration (#2)**: pure refactor, low user risk, lets future offline/native work land cheaply.
- **C — Offline + react-query (#3)**: most user-visible quality win, but easier after #2 is done.
- **D — Edge function rollout (#4)**: mechanical, can run in parallel with anything else.

My recommendation: **A → B → C → D**, in that order. A and D can be parallelized if you want me to interleave.
