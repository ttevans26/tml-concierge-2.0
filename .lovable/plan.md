## Post-MVP → iOS Production Readiness Roadmap

This is a sequenced engineering plan, not an implementation. Each section ends with the concrete files / connectors / tools to add.

```text
Phase A: Production hardening (web)   →   Phase B: Native bridge (Capacitor → iOS)   →   Phase C: App Store launch
```

---

### Phase A — Production-grade web foundation

These are blockers regardless of platform. Best done now while the codebase is small.

**A1. Auth hardening**
- Turn off zero-verification: enable email confirmation, enforce HIBP password check, add MFA (TOTP) for power users.
- Add **Apple Sign-In** via `supabase--configure_social_auth` — Apple requires it whenever any social login (Google) is offered in an iOS app, so wiring it now avoids rework.
- Add `/reset-password` flow (currently a stub) and email-change confirmation.
- Replace any `getSession()` used for trust checks with `getUser()` server-side.

**A2. Data layer audit**
- Run `supabase--linter` + `security--run_security_scan`; resolve every flagged table.
- Add explicit `GRANT`s on any tables created without them.
- Add composite indexes on hot paths: `itinerary_items(trip_id, date)`, `studio_items(folder_id, created_at)`, `trip_access_requests(owner_user_id, status)`.
- Replace `select *` with explicit column lists in `useTripStore`, `useStudioStore`, `useNotificationsStore` to reduce payload and unlock column-level grants.
- Add pagination/cursor APIs for lists that can grow unbounded (notifications, studio items, smart-pull inbox).
- Scope Realtime channels per trip (`postgres_changes` filtered by `trip_id=eq.…`) rather than table-wide; current global subscriptions will not scale past a few hundred users.

**A3. Edge function discipline**
- Every function in `supabase/functions/*` needs: zod input validation, structured logging, per-user rate limiting, and `verify_jwt` review.
- Centralize CORS via `npm:@supabase/supabase-js@2/cors` (already standard).
- Move `aviationstack-lookup`, `fetch-fx-rates`, `concierge-chat` behind a small Redis-backed (Upstash) rate limiter — Gemini/Aviationstack quotas are real.
- Add an `error_log` table or Sentry sink so edge failures are visible.

**A4. Service-layer abstraction**
- Today components import `supabase` directly. Introduce `src/services/{trips,studio,profile,notifications}.ts` wrappers that return typed promises. This is the single most important refactor for portability — it lets you swap transport (REST → tRPC → native bridge) without touching components.
- Keep Zustand stores as today, but have them call services, not raw supabase.
- Remove `/dev-sandbox` mock paths from `useTripStore` and `warningFilter` for production builds (keep behind `import.meta.env.DEV`).

**A5. Observability**
- Sentry (or PostHog Error Tracking) for browser + Edge Functions.
- PostHog or Plausible for product analytics with explicit event names: `trip_created`, `itinerary_item_added`, `concierge_message_sent`.
- Web Vitals reporting to Sentry/PostHog so regressions are caught before users complain.

**A6. Error & loading discipline**
- Add a top-level `<ErrorBoundary>` per route plus per-panel boundaries in TripWorkspace.
- Standardize on `react-query` (already installed) for server reads — replace ad-hoc `useEffect(fetch…)` patterns in `Today.tsx`, `Index.tsx`, `Network.tsx`. This gives retries, dedupe, and stale-while-revalidate for free.

**A7. Accessibility & i18n baseline**
- axe-core pass on the Matrix and Studio surfaces; current 0.5 px borders + 9 pt labels frequently fail contrast.
- Wrap user-visible strings in `react-i18next` even before adding a second locale — retrofitting later is painful.

**A8. Build pipeline & quality gates**
- GitHub Actions: typecheck, lint, vitest, `supabase db lint`, bundle-size budget on PR.
- Lighthouse CI on the published preview.
- Renovate/Dependabot for security updates.

---

### Phase B — Capacitor / iOS bridge

Capacitor 8 is already in `package.json` — half-installed. Finish the wrapper before adding native features.

**B1. Capacitor project init**
- Run `npx cap init` with `appId app.lovable.693f38f0fd12468791b16036a995ed65`, then `npx cap add ios`.
- Set production `webDir: "dist"`. Keep the live-reload `server.url` block dev-only.
- Configure `Info.plist` privacy strings: camera (document scan), photo library (avatars), location (proximity map), tracking (analytics).

**B2. Native capabilities — install only what's needed**
| Capability | Plugin | Use |
|---|---|---|
| Secure token storage | `@capacitor-community/keychain` | Replace `localStorage` Supabase session on native |
| Push | `@capacitor/push-notifications` + FCM | Flight gate changes, concierge replies, trip-share notifications |
| Deep links | `@capacitor/app` + universal links | `/itinerary/:token`, `/trip/:id` |
| Background fetch | `@capacitor/background-runner` | Periodic flight + cancellation-deadline polling |
| Haptics | `@capacitor/haptics` | Drag-drop feedback in Matrix |
| Status bar / safe area | already installed | Audit every fixed/sticky element for safe-area-inset |
| Camera + files | `@capacitor/camera`, `@capacitor/filesystem` | Document upload to `trip-documents` bucket |
| Geolocation | `@capacitor/geolocation` | Live distance from Anchor Stay |
| Network | already installed | Wire to `OfflineIndicator` |

**B3. Auth adapter for native**
- Supabase JS works in Capacitor but session persistence needs an adapter. Implement `CapacitorStorageAdapter` over Keychain and pass to `createClient({ auth: { storage } })` when `Capacitor.isNativePlatform()`.
- For Apple Sign-In on native, use `@capacitor-community/apple-sign-in` and post the identity token to Supabase via `signInWithIdToken({ provider: 'apple' })`.
- Google native: `@codetrix-studio/capacitor-google-auth` with same id-token flow.

**B4. Offline-first**
- Already have Zustand optimistic updates — extend with a persistent outbox: queued mutations stored via `@capacitor/preferences`, replayed on reconnect.
- IndexedDB cache of last trip + itinerary items so cold-launching offline shows last-known state.
- Conflict policy: server-wins for prices/dates, client-wins for notes; encode per-table.

**B5. Push pipeline**
- Edge function `send-push` that takes `user_id + payload`, looks up device tokens in a new `device_tokens` table, calls FCM (Android + iOS via APNs).
- Triggers: `cancellation-scan` cron, `aviationstack-lookup` delta, `trip_access_requests` insert, `notifications` insert.

**B6. App-shell readiness**
- Replace `window.location` usage with React Router navigation throughout (deep links break otherwise).
- Audit `fetch_website`/external URL handlers — open in `Browser.open` plugin on native, not `window.open`.
- Make every long press / drag work with touch (current dnd-kit setup already does, but verify on a real device).

---

### Phase C — App Store launch

**C1. Payments decision**
- If TML Concierge will ever sell subscriptions, premium trip slots, or "Concierge credits" to consumers, Apple **requires StoreKit IAP** for those purchases. Stripe is fine for business/B2B billing only.
- Use `RevenueCat` (Capacitor SDK) to abstract StoreKit + later Google Play Billing. Mirror entitlements into `profiles.subscription_tier`.

**C2. Privacy & compliance**
- App Privacy questionnaire: list every data category collected (auth email, location, payment, analytics).
- ATT prompt before any tracking SDK initializes (Sentry + PostHog need configuration to be IDFA-clean).
- GDPR/CCPA: `delete-account` function exists — add a user-initiated export endpoint + 30-day retention policy.
- Add a public privacy policy + terms URL; required at submission.

**C3. CI/CD for native**
- EAS Build, Codemagic, or Bitrise — pick one. Configure: signing certs, TestFlight upload, Play internal track. Mirror Vite web build into Capacitor sync step.
- Source-map upload to Sentry on every build.

**C4. Test plan**
- Detox or Maestro for native smoke tests (login → create trip → drag item → open concierge).
- Vitest for stores/services.
- Manual device matrix: iPhone SE (small), 15 Pro (notch), iPad (split view).

---

### Suggested execution order

1. A1, A2, A3 (auth + data + edge hardening) — required before any external users.
2. A4, A6 (service layer + react-query) — the refactor that makes everything after easier.
3. A5, A7, A8 (observability, a11y, CI) — parallelizable.
4. B1 → B3 → B4 → B5 (native shell, auth, offline, push, in that order).
5. C1 → C2 → C3 → C4.

### Out of scope here
- Visual design changes
- Adding new product features
- Migrating off Lovable Cloud (Supabase is appropriate for both web and native long-term)
