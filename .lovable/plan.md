# Release 2.0 — Sprint 1 Build Plan

Eight workstreams, sequenced by dependency. Each is independently shippable. Bundled into three logical waves so we can ship value mid-sprint.

---

## Wave A — Foundation (must land first)

### 1. Auth Hardening
**Goal:** App is safe to hand to external testers.

- Enable **Google OAuth** via `supabase--configure_social_auth` (`providers: ["google"]`) and add a "Continue with Google" button to `Login` and `Signup` using `lovable.auth.signInWithOAuth("google", ...)`.
- Switch `useAuth.signUp` to require email verification (turn off auto-confirm); add a "check your inbox" state to `Signup.tsx`.
- Wire `ForgotPassword` / `ResetPassword` to real Supabase calls (already scaffolded — just verify the `redirectTo` and add success states).
- **Profile editing**: new `ProfileSettings` panel inside the existing `ProfileDrawer` — edit `display_name`, `avatar_url` (Supabase Storage bucket `avatars`, public read), and travel preferences.
- **Account deletion**: edge function `delete-account` that calls `auth.admin.deleteUser()` after re-auth confirmation; cascade-delete trips/items/folders.
- Enable HIBP leaked-password protection via `configure_auth`.

**DB:** create `avatars` storage bucket (public read, owner write); no schema changes.

### 2. Concierge Conversational Thread (foundation for #6 and #7)
**Goal:** Real chat replaces the floating placeholder. Required before gap-fix routing has somewhere to live.

- New table `concierge_conversations` (id, user_id, trip_id, title, created_at) and `concierge_messages` (id, conversation_id, role, content, tool_calls jsonb, created_at). RLS by `auth.uid()`.
- Rewrite `supabase/functions/concierge-chat/index.ts` to:
  - Accept full message history.
  - Stream responses (SSE) using Lovable AI Gateway (`google/gemini-2.5-flash` default, `pro` for planning).
  - Expose tools: `create_itinerary_item`, `open_scheduling_modal`, `search_studio`, `lookup_flight`, `suggest_gap_fix`.
- Replace `ConciergePanel` body with a real chat UI: thread list (left), streaming messages with `react-markdown`, tool-call cards rendered inline.
- Persist `pendingConciergePrompt` → opens or creates a conversation, sends as first message.

---

## Wave B — Workspace Polish

### 3. Matrix Cross-Day Drag + Undo/Redo
- Extend the existing drag handlers in `MatrixGrid.tsx` so an in-grid card is a drag source as well as a drop target (currently only Studio items are sources).
- On drop: update `date` + `category` via `updateItineraryItem`, with optimistic UI in `useTripStore`.
- **Undo/Redo**: add a bounded `historyStack` / `redoStack` (size 50) in `useTripStore` capturing `{op, before, after}` for create/update/delete/move. Keyboard: ⌘Z / ⇧⌘Z. Toolbar buttons in `TripWorkspace` header.

### 4. Conflict Auto-Resolve
- Extend `lib/gapDetection.ts` (or add `lib/conflictResolution.ts`) to emit a `suggestedFix` per conflict: move to next free slot, swap stay nights, split overlapping activities, etc.
- In `TripHealthBar` and `ConciergePanel`, render an **"Apply fix"** button per conflict that runs the suggested mutation through `updateItineraryItem` (so it's undo-able).
- Complex/ambiguous conflicts route through the new chat (see #2) with a pre-filled prompt.

### 5. Gap-Fill → Scheduling Engine Routing
- Replace the current "ship as draft" handler on gap suggestion buttons with `openSchedulingModal({ date, category, prefill })`.
- `SchedulingModal.tsx` accepts a `prefill` prop (title, time window, location, source) so the user reviews/edits before commit.
- Concierge tool `suggest_gap_fix` returns structured items the modal can consume directly.

### 6. Cancellation Reminders
- DB: new column already exists (`cancellation_deadline`). Add `notification_preferences jsonb` to `profiles` (lead-time defaults).
- Edge function `cancellation-scan` (cron via Supabase scheduled function, daily) finds items with `cancellation_deadline` within lead-time and writes to a new `notifications` table.
- UI: extend `NotificationsPopover` to read from `notifications`, show count badge.
- iOS: foreground via `@capacitor/local-notifications`; web via in-app popover only this sprint. Push notifications deferred to a later milestone.

---

## Wave C — Ingest Upgrades

### 7. Studio Bulk Import + PDF / Image OCR
- Extend `scrape-and-parse` edge function to accept:
  - An array of URLs (loop server-side, return per-URL status).
  - A base64 PDF (parse text with `pdf-parse` / Gemini multimodal).
  - A base64 image (Gemini 2.5 Flash multimodal for OCR + structured extraction).
- New `BulkImportDialog` in Studio: textarea for URL list, drop-zone for PDFs/images. Results land in the existing Review tray.
- Per-item progress, retry on partial failures.

### 8. Smart Pull — Gmail Connector
- Use `standard_connectors--connect` with `connector_id: google_mail` (builder's mailbox model — explain in UI that this connects *the user's* mailbox and that we'll need per-user OAuth later).
- New edge function `smart-pull-gmail` queries `is:unread (from:booking OR from:hotel OR ...)` via the connector gateway, pipes each message body through the existing `smart-pull` parser.
- New "Sync Gmail" button in `SmartPullInbox`; results merge into the existing tray.
- Acknowledge limitation: this sprint connects one mailbox per workspace. Per-user OAuth (each tester connects their own Gmail) is a follow-up milestone — flagged but out of scope here.

---

## Ship Order Within the Sprint

1. **Day 1–2** — Wave A #1 (Auth) and DB migrations for #2, #6.
2. **Day 3–5** — Wave A #2 (Concierge thread + streaming).
3. **Day 6–8** — Wave B #3, #4, #5 (workspace polish, all leverage Wave A).
4. **Day 9–10** — Wave B #6 (reminders) + Wave C #7 (bulk/OCR).
5. **Day 11–12** — Wave C #8 (Gmail) + QA pass.

---

## Technical Notes (for review)

- **No iOS-native work in this sprint.** App icon, splash, push, biometric, share-sheet — deferred to the next iOS-focused milestone so we can ship the web app to testers first. `@capacitor/local-notifications` is the only Capacitor plugin touched (for #6), and it degrades gracefully on web.
- **New tables:** `concierge_conversations`, `concierge_messages`, `notifications`. **New storage bucket:** `avatars`. All RLS-scoped to `auth.uid()` with `service_role` grants for edge functions.
- **New edge functions:** `delete-account`, `cancellation-scan` (scheduled), `smart-pull-gmail`. **Updated:** `concierge-chat` (streaming + tools), `scrape-and-parse` (bulk + multimodal).
- **Lovable AI Gateway** covers all model calls — no new API keys needed for concierge or OCR.
- **New connector:** `google_mail` for #8.
- **Existing memory files** stay accurate; will add `mem://features/concierge-chat`, `mem://features/cancellation-reminders`, `mem://features/bulk-import` after build.

## Out of scope (explicitly deferred)

- iOS push notifications, app icon/splash, App Store assets, share-sheet extension, biometric unlock.
- Per-user Gmail OAuth (each tester their own mailbox).
- Travel Network real data, Trip Access Requests UI, comments.
- Real Mapbox/Google Maps proximity rendering.
- Per-category budget caps, real cpp points math, live FX.
- Sentry / PostHog / E2E test infrastructure.
