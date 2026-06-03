# Demo-Ready Functional Gap Plan

Goal: every visible click-path in the demo lands somewhere believable. Real backend swaps, mailbox connectors, per-user OAuth, etc. stay deferred to Release 2.0. The fixes below are scoped to UX/content gaps that would visibly break a guided demo.

## Scope (in)

### 1. Travel Network — replace "mock" feel with curated demo content
- Keep `MOCK_NETWORK_USERS` / `MOCK_NETWORK_TRIPS` as the data source (no real social graph this milestone).
- Refresh content so it reads as a real "Travel Network" — replace lorem-ish names/destinations with 6–8 plausible TML-style profiles (e.g. "Marcus Chen — 14 trips planned", real city names matching trip dates Aug–Sept 2026).
- Add a subtle "Curated demo network" footnote on `/network` so reviewers know what they're seeing (single line, muted; no big banner).
- Wire **Request Access** button to a local optimistic state + toast ("Request sent — they'll see it in their inbox") so the click-path completes.

### 2. Travel Warnings Feed — turn mock list into a believable live feed
- Keep `MOCK_TRAVEL_WARNINGS` as source; rewrite entries to match likely Aug–Sept 2026 destinations actually in user trips (pull destinations from `useTripStore.trips` and filter accordingly — already partly done via `filterWarningsForTrip`).
- Add `published_at` recency labels ("2 days ago") computed from `Date.now()` so the feed feels live.
- Add small "Source: U.S. State Dept / WHO (curated)" caption so it's clearly demo-curated, not fabricated authority.

### 3. Concierge Inspiration / Gemini placeholder cleanup
- The `GeminiFooter` floating button and `ConciergePanel` both call `concierge-chat` — verify both render a non-empty response in demo. If the function returns `429`/`unavailable` the panel shows a destructive toast; add a friendly fallback message ("Concierge is warming up — try again in a moment") instead of a red error toast for first-load 429.
- Hide the floating `GeminiFooter` on `/trip/:id` since `ConciergePanel` already serves that surface (currently both visible → confusing in demo).

### 4. Tools page — Upcoming Appointments empty state
- Inspect `UpcomingAppointments`; if list is empty for the demo trip, render a single seeded example ("Visa appointment — Italian Consulate · Aug 4") tied to the active trip so the panel never demos empty.
- Same treatment for `PreparednessChecklist` AI tasks — confirm `deriveAiTasks` returns at least 3 derived items for the seeded itinerary; otherwise add a fallback derived item ("Confirm passport valid 6+ months past return date").

### 5. Dashboard `Index` — empty/first-run polish
- If `trips.length === 0`, render a single "Sample Trip" CTA card seeded with the Aug 21 – Sept 17 2026 demo trip parameters so the demo can be reset and still look populated.

### 6. Profile drawer — "Avatar uploads coming soon" copy
- Remove the "coming soon" label and either (a) wire to existing `avatars` Supabase bucket (if present) or (b) cleanly hide the upload control behind a placeholder ring. Pick (b) for demo speed — initials avatar, no broken button.

### 7. ShareControls / PublicTripView spot-check
- Confirm `/share/:token` loads without auth and redacts financial fields (RLS view already in place). Add only what's needed: a one-line "View-only — costs redacted" caption at the top of the public view if missing.

### 8. Studio → Matrix drag, Smart Pull paste, Proximity Map
- These were just shipped in prior milestones — smoke-test once via browser tool to confirm no regression; no scoped change unless something is broken.

## Scope (out — Release 2.0)

- Real social graph / Trip Access Requests backend wiring.
- Real travel-warnings data source (State Dept API / RSS).
- Gmail/Nylas mailbox connector for Smart Pull.
- Per-category budget caps, real cpp redemption math, live FX rates.
- Push notifications, Live Activities, iOS share-sheet, biometric.
- Sentry, PostHog, Playwright E2E, image upload via Supabase Storage.
- Avatar upload pipeline.

## Technical notes

- All changes are frontend-only except possibly seeding one demo trip. No new tables, no new edge functions, no new secrets.
- Files touched (estimate):
  - `src/data/mockNetworkUsers.ts`, `src/data/mockNetworkTrips.ts`, `src/data/mockTravelWarnings.ts` — content refresh.
  - `src/pages/Network.tsx`, `src/components/network/ConnectionsList.tsx` — Request Access toast + "curated" footnote.
  - `src/components/tools/TravelWarningsFeed.tsx` — recency labels + source caption.
  - `src/components/GeminiFooter.tsx` — hide on `/trip/:id`; soften 429 toast.
  - `src/components/workspace/ConciergePanel.tsx` — same toast softening.
  - `src/components/tools/UpcomingAppointments.tsx`, `src/components/tools/PreparednessChecklist.tsx` — seeded fallback items.
  - `src/pages/Index.tsx` — empty-state seed CTA.
  - `src/components/ProfileDrawer.tsx` — remove "coming soon" copy, clean avatar fallback.
  - `src/pages/PublicTripView.tsx` — view-only caption if missing.
- Browser smoke test after edits: load `/`, open a trip, open Concierge tab, open Map tab, open Studio, open `/network`, open `/tools`, open `/share/:token`.
