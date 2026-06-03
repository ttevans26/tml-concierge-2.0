# Desktop Polish + Functional Fill-Out

Twelve items grouped by surface. All desktop-only (mobile deferred per your call). Each is sized to be independent so we can ship incrementally.

## 1. Gmail Smart Pull — connection status + error clarity

The Gmail connector is already linked at workspace level (`GOOGLE_MAIL_API_KEY` is present). The real gap is **silent failure when the token is invalid or scopes are missing**. Not a per-user OAuth flow.

- Add a tiny `GET` mode to `smart-pull-gmail` (`?mode=status`) that hits the gateway `verify_credentials` endpoint and returns `{ connected: bool, error?: string }`.
- `SmartPullInbox.tsx`: on mount, call status. Show:
  - **Connected** — green dot + "Gmail connected" subtitle, Sync button enabled.
  - **Not connected** — amber dot, "Gmail not connected" subtitle, Sync button disabled, link "Open Connectors" pointing to `/settings` route or external `https://lovable.dev/projects/.../connectors` (use existing external-link pattern in app).
  - On a 403 insufficient-scope error from a sync, surface a toast + persistent inline notice naming the missing scope.

## 2. Concierge — inline tool-call result cards

Store already returns `tool_results: [{name, args, result}]` from `concierge-chat`. They're toasted but never shown inline.

- Persist tool results alongside assistant message in component state. Load from DB on thread switch by reading sibling `role='tool'` messages (already saved with `tool_calls.name` + JSON content).
- New `<ConciergeToolCard>` rendered beneath each assistant bubble that ran tools. Shows:
  - Tool name (humanised: `create_itinerary_item` → "Added to itinerary")
  - Compact summary (title, date, category) from `result.item`
  - "View in Matrix" jump button (sets active trip if needed, scrolls to date column)
  - Failure cards in destructive red with the error message
- Collapsible per card (`<Collapsible>` from shadcn — already in deps).

## 3. Trip switcher in workspace header

`TripWorkspace.tsx` header currently shows trip name only.

- Replace plain `<h1>` with a `<DropdownMenu>` trigger using `ChevronsUpDown`. List all trips ordered by `start_date`, click → `navigate(\`/trip/\${id}\`)`. Active trip marked with `Check` icon.
- Group items into "Upcoming", "In progress", "Past" sections based on date math.

## 4. Today page — enrich

Page already pulls today/tomorrow items. Add:

- **Trip context line**: "Day 3 of 28 · 12 days left" computed from `start_date`/`end_date`.
- **Next Up hero**: pick the next item ≥ now (by start_time on today, else tomorrow's first). Pinned at top of items list with a distinct card style.
- **Cancellation deadlines this week**: scan items where `cancellation_deadline` is within 7 days; show as orange-tinged callout list above today.
- **Confirmation status pill** per item (Draft / Confirmed / Cancelled) — reuse `approval_status`.

## 5. Budget sidebar — currency conversion

Trips have a `currency` (in custom metadata) but rollup is hard-coded `$`. Add:

- New JSONB column `display_settings` on `trips`? — simpler: store `display_currency` and `fx_rates` on existing `trips` row as new nullable columns (`display_currency TEXT`, `fx_rates JSONB`). Single migration.
- New edge function `fetch-fx-rates` calling `https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP,JPY,...` (no key, public, stable). Returns map + timestamp; persisted to `trips.fx_rates` with a "fetched at" key.
- `BudgetSidebar.tsx`:
  - Display-currency dropdown (USD/EUR/GBP/JPY plus "+ Add" inline input).
  - "Refresh rates" button next to it (calls function, toasts age "1h ago").
  - Conversion logic: each item's `cost` is interpreted in `item.currency`; convert each to display currency via stored rates, sum.
  - Show two figures stacked: large display-currency number, small "≈ $X,XXX USD" subtle.
- No item-level edits — purely a display layer.

## 6. Packing list

New per-trip feature, lives in TripWorkspace right panel as a 4th tab "Packing".

- Migration: `trip_packing_items` (`trip_id`, `category` TEXT, `name` TEXT, `qty` INT default 1, `is_packed` BOOL, `notes` TEXT). RLS + GRANTs per standard pattern.
- Edit function `generate-packing-suggestions` (optional; later) — for v1 just provide static defaults per trip (Documents, Clothing, Toiletries, Electronics) and let user add freely.
- `PackingList.tsx`: grouped checklist with add/edit/delete + drag-reorder later. Progress bar at top.
- Wire as 4th right-panel tab alongside Budget/Concierge/Map.

## 7. Document storage

New per-trip secure document attachment.

- Migration: storage bucket `trip-documents` (private). Plus table `trip_documents` (`trip_id`, `user_id`, `path` TEXT, `original_name` TEXT, `mime_type` TEXT, `size_bytes` BIGINT, `kind` TEXT — passport/insurance/voucher/other, `notes`). RLS + GRANTs.
- Upload via `supabase.storage.from('trip-documents').upload(...)` with path `userId/tripId/uuid-filename`.
- View via `createSignedUrl(path, 3600)` on demand.
- `TripDocuments.tsx`: list with thumbnail (PDFs get a generic icon), upload button, signed-URL "View" + "Download", delete with confirm.
- Wire as a 5th right-panel tab "Documents".

## 8. TripCard duplicate / delete dropdown

`src/pages/Index.tsx` TripCard:

- Add a `<DropdownMenu>` triggered by `MoreVertical` icon in the card top-right corner (over the countdown panel area to avoid the main click target).
- Items: **Duplicate** (creates a new trip with same name + " (copy)" and re-inserts all itinerary_items shifted to current week as drafts) and **Delete** (`<AlertDialog>` confirm → existing `deleteTrip`).
- Add `duplicateTrip(id)` to `useTripStore` that fetches items via Supabase and bulk-inserts cloned rows.

## 9. Tools page — true empty state when no trips

When `trips.length === 0`:

- Replace the "Select a trip" placeholder with a primary-CTA empty state: "No trips yet — concierge tools work once you've created a journey" + "+ New Journey" button that navigates to `/` and opens the create dialog (use route state).

## 10. TripWorkspace right-panel polish

- Replace inline `style={{ writingMode: 'vertical-rl' }}` (lines 135, 217) with a new Tailwind utility added to `tailwind.config.ts`: `writingMode: { 'vertical-rl': 'vertical-rl' }` exposed as `[writing-mode:vertical-rl]` (use arbitrary value or extend) — final class `[writing-mode:vertical-rl]`. Single source of truth.
- Convert the four bare `<button>` tabs (Budget/Concierge/Map/Collapse) at lines 152-194 to `<Button variant="ghost">` with `min-h-[44px]`, consistent focus ring, and `data-active` styling for the underline.

## 11. Files

**New**
- `src/components/workspace/ConciergeToolCard.tsx`
- `src/components/workspace/TripSwitcher.tsx`
- `src/components/workspace/PackingList.tsx`
- `src/components/workspace/TripDocuments.tsx`
- `src/hooks/useGmailConnectionStatus.ts`
- `supabase/functions/fetch-fx-rates/index.ts`

**Edited**
- `src/components/workspace/SmartPullInbox.tsx` (status pill + disabled state)
- `src/components/workspace/ConciergePanel.tsx` (load + render tool messages)
- `src/components/workspace/BudgetSidebar.tsx` (currency selector + conversion)
- `src/pages/TripWorkspace.tsx` (header switcher, panel buttons, writing-mode token, 4-tab → 5-tab)
- `src/pages/Today.tsx` (next-up, cancellations, day counter)
- `src/pages/Tools.tsx` (empty state when zero trips)
- `src/pages/Index.tsx` (TripCard dropdown)
- `src/stores/useTripStore.ts` (`duplicateTrip`, currency helpers)
- `supabase/functions/smart-pull-gmail/index.ts` (status mode)
- `tailwind.config.ts` (writing-mode utility)
- `mem://index.md` + new entries for the heavier features

**Migrations (separate files)**
- Add `display_currency` + `fx_rates` to `trips`
- Create `trip_packing_items` (with GRANTs + RLS)
- Create `trip_documents` (with GRANTs + RLS) + `trip-documents` storage bucket (private)

## 12. Out of scope

- Mobile breakpoints (deferred per your direction)
- Per-user Gmail OAuth — the builder Gmail account is what the connector exposes; we surface state, not a new auth flow
- AI-generated packing lists / document OCR (later)
- Multi-currency on per-item entry forms — purely a display rollup change
