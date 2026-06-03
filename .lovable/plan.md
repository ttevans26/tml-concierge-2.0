## Deferred Batch — Implementation Plan

Scope: ship the 6 deferred items from the demo-readiness audit. Avatar uploads are blocked by workspace policy (public buckets disabled) — included as a deferred note, not built.

---

### 1. Concierge chat persistence + tool-calling rewrite

Tables `concierge_conversations` and `concierge_messages` already exist with RLS. The current `ConciergePanel` + `concierge-chat` edge function is a stateless one-shot.

- Refactor `concierge-chat` to accept `conversation_id`, load prior messages, append new user message, stream Gemini response (SSE), persist assistant reply + `tool_calls` JSON.
- Define a small tool schema: `create_itinerary_item`, `search_studio_items`, `suggest_anchor`, `get_trip_summary`. Execute tool calls server-side against the trip via service role with `user_id` from JWT.
- Rewrite `ConciergePanel`: conversation list sidebar (new / rename / delete), threaded message view with `react-markdown`, streaming indicator, tool-call chips ("Added Aman Venice to Day 3").
- Persist active `conversation_id` per trip in `useTripStore`.

### 2. Bulk Import dialog + PDF/image OCR

`scrape-and-parse` already accepts arrays. UI is single-URL.

- New `BulkImportDialog` opened from Studio header: tabs for **URLs** (textarea, one per line), **PDF/Image** (drop zone, multi-file).
- For PDFs/images: upload to a new private `import-uploads` bucket, call extended `scrape-and-parse` with `{ type: 'file', storage_path }`. Backend uses Gemini multimodal (vision) to extract structured items — no separate OCR service.
- Progress list with per-item status (queued / parsing / done / failed), bulk "Send to Review Tray".

### 3. NotificationsPopover → real `notifications` table

Currently mocked. Schema exists; `cancellation-scan` already writes rows.

- Replace mock data with Supabase query: `select * from notifications where is_dismissed = false order by created_at desc limit 50`.
- Realtime subscription on `notifications` filtered by `user_id`.
- Actions: mark read (`is_read = true`), dismiss (`is_dismissed = true`), click → route to trip/item.
- Unread badge count from query.

### 4. Gap-fill → SchedulingModal + conflict "Apply fix"

`SchedulingModal` and `conflictResolution.ts` exist but aren't wired.

- In `MatrixGrid`, gap-detection action buttons currently insert drafts directly — change to open `SchedulingModal` pre-filled with `{ date, category, suggestion }`.
- In `ItineraryItemCard` conflict badge, add **Apply fix** button. Reads suggested resolution from `conflictResolution.ts` (shift time, move day, drop overlap) and applies via `updateItineraryItem`.
- Toast with undo on both actions.

### 5. Gmail connector for Smart Pull

Today: paste-only into `SmartPullInbox`.

- Use the **Google Mail** App connector (workspace owner's inbox — surface this caveat in UI: "Connected inbox: <email>. Forward reservations here.").
- New edge function `smart-pull-gmail`: lists last 50 messages matching `subject:(reservation OR booking OR itinerary) newer_than:90d`, passes body to existing `smart-pull` parser, writes results to review tray.
- "Sync Gmail" button in `SmartPullInbox` header + 15-min cron (pg_cron) for background pulls.
- Requires `standard_connectors--connect` with `google_mail` on `gmail.readonly` scope before deploy.

### 6. Avatar uploads — deferred note only

Workspace policy `cloud_block_public_buckets` blocks the public bucket this needs. Options for the user:
- (a) Enable public buckets in workspace Settings → Privacy & Security, then we add `avatars` bucket + upload UI in `ProfileDrawer`.
- (b) Keep private bucket and serve via signed URLs (works today, slightly slower image loads).

No build until the user picks (a) or (b).

---

### Suggested execution order

1. Notifications wiring (smallest, unblocks demo polish)
2. Gap-fill / conflict apply-fix wiring (frontend-only)
3. Bulk import dialog (UI + backend extension)
4. Concierge persistence + streaming + tool calls (largest)
5. Gmail connector (requires user to link connection first)
6. Avatar uploads (after user decides on bucket policy)

### Out of scope (Release 2.0)

Cross-day drag inside Matrix, undo/redo stack, push/email notification delivery, Nylas multi-provider mail, screenshot OCR via dedicated Vision API (Gemini multimodal covers demo).