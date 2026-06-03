# Demo-Blocker Fix Plan

Six workflows, all desktop-only, all incremental wiring on top of components/tables that already exist. No new tables required.

---

## 1. Concierge tool-call result cards

**Problem**: `concierge-chat` executes tool calls but the chat renders only the assistant's text. `ConciergeToolCard.tsx` exists but is never mounted.

**Changes**
- `concierge-chat/index.ts`: after each tool execution, append a `role='tool'` message with `tool_calls` JSON containing `{name, args, result, status, affected_item_ids[]}`.
- `ConciergePanel.tsx`: in the message map, when `msg.role === 'tool'` render `<ConciergeToolCard>` instead of a text bubble.
- `ConciergeToolCard.tsx`: humanize tool names (`add_itinerary_item` → "Added to itinerary"), show compact summary line + collapsible args/result JSON, red border on `status='error'`, and a "View in Matrix" link that calls `useTripStore.setSelectedItemId(id)` for the first affected item.

---

## 2. Approval status UI (draft / confirmed / cancelled)

**Problem**: `approval_status` enum exists on `itinerary_items` but nothing flips it; everything is stuck on `draft`, so Today page pills and cancellation warnings have no signal.

**Changes**
- `useTripStore.ts`: add `updateItemStatus(itemId, status)` action (optimistic, single column update).
- `EditItemDialog.tsx`: add a 3-segment toggle (Draft / Confirmed / Cancelled) at the top of the form, with bronze accent on active.
- `ItineraryItemCard.tsx`: add a small status pill (top-right) — gray for draft, bronze for confirmed, strikethrough + muted for cancelled.
- `Today.tsx`: filter out `cancelled` items from Next Up; show confirmation pill where space allows.

---

## 3. Social import review tray

**Problem**: `studio_social_imports` rows land with `status='pending'` but there's no UI to triage them.

**Changes**
- New `src/components/studio/SocialImportTray.tsx`: slide-out sheet listing pending imports with thumbnail, caption, detected destination, and a per-item table of `extracted_items` (editable title + category dropdown + folder selector).
- Per-row actions: **Approve** (insert into `studio_items`, set import `status='approved'`), **Reject** (set `status='rejected'`), **Edit** (inline).
- Bulk: "Approve all" and "Reject all" at the top of the tray.
- Mount trigger in `StudioSidebar.tsx` as a bell badge showing pending count (poll `studio_social_imports` on mount + after `ingest-social-post` returns).

---

## 4. Trip Editor orphan resolution

**Problem**: `OrphanItemsBanner` shows count; `OrphanItemsSheet` lists items but offers no resolution.

**Changes**
- `OrphanItemsSheet.tsx`: per-row controls — date picker (constrained to the new trip range), category dropdown, and a Delete icon. "Save all" applies in one batch via `useTripStore.bulkUpdateItems`.
- Add "Delete all orphans" destructive button at the footer with `AlertDialog` confirm.
- Make the banner auto-dismiss when orphan count drops to 0 (already derived, just guard the render).
- Add a discoverable entry to open `EditTripDialog`: a pencil icon next to the trip name in `TripSwitcher` header area in `TripWorkspace.tsx`.

---

## 5. Gmail Smart Pull connect gate + status

**Problem**: `useGmailConnectionStatus` hook exists, `smart-pull-gmail?mode=status` endpoint exists, but `SmartPullInbox` doesn't consume either.

**Changes**
- `SmartPullInbox.tsx`:
  - Call `useGmailConnectionStatus()` on mount.
  - Header row: green dot + "Gmail connected" OR amber dot + "Not connected" with a **Connect Gmail** button that opens the connector picker (link to settings drawer route).
  - Sync button `disabled` until status is `connected`.
  - Surface 403/insufficient-scope errors inline with a "Reconnect with more access" CTA.

---

## 6. TripCard duplicate / delete

**Problem**: `duplicateTrip` / `deleteTrip` actions exist on the store but nothing calls them.

**Changes**
- `Index.tsx` TripCard: add a `<DropdownMenu>` with `MoreHorizontal` trigger (top-right of card, `min-h-[44px]` hit zone).
  - **Duplicate** → call `duplicateTrip(id)`, navigate to new trip, toast.
  - **Delete** → open `<AlertDialog>`, on confirm call `deleteTrip(id)`, toast.
- Stop click-propagation on the trigger so the card link doesn't fire.

---

## Files

**New**
- `src/components/studio/SocialImportTray.tsx`

**Edited**
- `supabase/functions/concierge-chat/index.ts`
- `src/components/workspace/ConciergePanel.tsx`
- `src/components/workspace/ConciergeToolCard.tsx`
- `src/components/workspace/EditItemDialog.tsx`
- `src/components/workspace/ItineraryItemCard.tsx`
- `src/components/workspace/OrphanItemsSheet.tsx`
- `src/components/workspace/OrphanItemsBanner.tsx`
- `src/components/workspace/SmartPullInbox.tsx`
- `src/components/studio/StudioSidebar.tsx` (or wherever the sidebar lives)
- `src/pages/TripWorkspace.tsx` (edit-trip entry icon)
- `src/pages/Today.tsx` (status pill filter)
- `src/pages/Index.tsx` (TripCard dropdown)
- `src/stores/useTripStore.ts` (`updateItemStatus`, `bulkUpdateItems`)

**No migrations.** All schema already in place (`approval_status` enum, `studio_social_imports`, `display_currency`, etc.).

---

## Out of scope (intentionally deferred)

- Mobile breakpoints
- Cancellation deadline notifications cron
- Aviationstack auto-refresh for upcoming flights
- Share-link access request inbox
- FX currency switcher in BudgetSidebar
- AI-aware packing list

Ready to implement once approved.