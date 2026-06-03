
# A2 — Data Layer Audit & Hardening

## Status: SHIPPED (turn N)

- Migration applied: 15 hot-path indexes, `bulk_update_item_dates(jsonb)` RPC, GRANT realignment.
- GRANT fix: `anon` SELECT removed from 13 auth-only tables; granted only on `trips` and `itinerary_items` (needed for public share links). Service-role and authenticated explicit.
- `useTripStore`: replaced every `SELECT *` with explicit column lists (`TRIP_COLUMNS`, `ITINERARY_COLUMNS`, `FLIGHT_COLUMNS`, `PROFILE_COLUMNS`); soft cap `.limit(500)` with console warning on `fetchTrips` / `fetchItineraryItems`; `bulkUpdateItemDates` now a single RPC call.
- `useStudioStore`: explicit columns + 2000 limit on items.
- `ConciergePanel`: messages capped at 200 per thread.
- `SocialImportsTray`: Realtime channel scoped with `filter: user_id=eq.<uid>`.
- `NotificationsPopover`: already scoped & limited.
- Linter: only the two pre-existing intentional SECURITY DEFINER warnings remain (`has_role`, `request_trip_access`).

### Deferred to follow-up turns
- Caching `auth.uid()` in store to avoid `supabase.auth.getUser()` per mutation (A1 turn).
- Cursor pagination UI (Phase B).
- Service-layer migration of `itineraryItems` / `notifications` (A4).

---

# A3 — Edge function discipline (SHIPPED)

- New `supabase/functions/_shared/`: `cors.ts`, `logger.ts` (structured JSON), `validate.ts` (zero-dep schema lib), `rate-limit.ts` (in-isolate token bucket), `handler.ts` (CORS/rate-limit/error envelope).
- Applied to `aviationstack-lookup` (30 req/min/IP, IATA + date schema) and `ingest-social-post` (10 imports/min/IP, URL + note schema).
- Echoes `x-request-id` on every response for client-side correlation.
- Removed hardcoded Aviationstack fallback API key and stopped echoing upstream error bodies to clients.

### Follow-ups (apply same pattern, copy-paste)
- `concierge-chat`, `scrape-and-parse`, `smart-pull*`, `get-concierge-suggestions`, `cancellation-scan`, `fetch-fx-rates`, `delete-account`.
- For strict global rate limits, back the bucket with a Postgres `rate_limits` table or Upstash.

---

# A4 — Service-layer scaffolding (SHIPPED, adoption in-flight)

- Fixed `services/trips.ts` column list to match live schema (`name`, `display_currency` etc.).
- Added `services/itineraryItems.ts`, `services/notifications.ts`, `services/profile.ts`, `services/flights.ts`. All export explicit column constants and use `wrapError` → `ServiceError`.
- `services/itineraryItems.bulkUpdateDates` wraps the new RPC.
- Migrated `NotificationsPopover` off direct `supabase.from("notifications")` calls — reference adoption pattern.
- `src/services/index.ts` exposes the new namespaces.

### Follow-ups
- Migrate `useTripStore` (~13 call sites), `useStudioStore` (~5 call sites), `PackingList`, `TripDocuments`, `ConciergePanel`, `SocialImportsTray` to import from `@/services`.
- Goal: only services files contain `from "@/integrations/supabase/client"`.

---

# A6 — Resilience + a11y/i18n

Deferred to next turn. AppErrorBoundary at root already exists; remaining work is route-level boundaries, skip-link, ARIA passes, and i18n stub.

Goal: make the database safe, fast, and portable before we widen the user base or move toward iOS. No new features — only schema, indexes, GRANTs, query shape, and Realtime scoping.

---

## 1. Run baseline scans (read-only, no DB changes)

Execute in order and capture output before changing anything:

1. **Supabase linter** — `supabase--linter`
   - Triage: ignore the two known SECURITY DEFINER warnings on `has_role` and `request_trip_access`. Anything else (missing RLS, exposed columns, multiple permissive policies, unused indexes) gets a ticket below.
2. **Security scan** — `security--run_security_scan` followed by `security--get_scan_results`
   - Cross-check against `<supabase-tables>`: every public table must have `auth.uid()`-scoped policies. The only intentional public reads are `trips (is_published=true)` and `itinerary_items (via published trip)`.
3. **Table schema sanity** — `security--get_table_schema`
   - Confirms RLS is enabled on all 15 tables.
4. **DB health** — `supabase--db_health` (slow queries, cache hit ratio, bloat) and `supabase--analytics_query` for top-10 slow statements over the last 7 days.
5. **GRANT audit** — `supabase--read_query`:
   ```sql
   SELECT table_name, grantee, string_agg(privilege_type, ',') AS privs
   FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
   GROUP BY 1,2 ORDER BY 1,2;
   ```
   Required state per table is in section 3.

---

## 2. Indexes to add (one migration)

Driven by the hot paths in `useTripStore` and `Index.tsx`. All `CREATE INDEX CONCURRENTLY` is unavailable inside a Supabase migration transaction, so use plain `CREATE INDEX IF NOT EXISTS`.

| Table | Index | Why |
|---|---|---|
| `itinerary_items` | `(trip_id, date)` | `fetchItineraryItems` + Matrix Grid day buckets |
| `itinerary_items` | `(trip_id, sort_order)` | current `.order("sort_order")` query |
| `itinerary_items` | `(user_id, date DESC)` | Today / upcoming widgets on Index.tsx |
| `itinerary_items` | `(trip_id, category)` | category filters in Matrix |
| `trips` | `(user_id, created_at DESC)` | `fetchTrips` order |
| `trips` | `(share_token)` where `is_published` | `request_trip_access` lookup |
| `flight_tracking` | `(trip_id, departure_time)` | `fetchFlights` order |
| `notifications` | `(user_id, is_dismissed, created_at DESC)` | popover query in `NotificationsPopover.tsx:77` |
| `trip_packing_items` | `(trip_id, sort_order)` | `PackingList` queries |
| `trip_documents` | `(trip_id, created_at DESC)` | `TripDocuments` list |
| `concierge_messages` | `(conversation_id, created_at)` | message thread fetch |
| `concierge_conversations` | `(user_id, updated_at DESC)` | conversation list |
| `studio_items` | `(user_id, folder_id)` | vault listing |
| `studio_social_imports` | `(user_id, status, created_at DESC)` | tray polling |
| `trip_access_requests` | `(owner_user_id, status)` and `(requester_user_id)` | dashboard pending list |

After running, re-execute `supabase--linter` to confirm no "unused index" warnings on these (they will be cold for 24h — note this in plan.md, not a regression).

---

## 3. GRANT verification (same migration if anything missing)

Expected state per `<public-schema-grants>`:

- **service_role**: `ALL` on every table (edge functions need it).
- **authenticated**: `SELECT, INSERT, UPDATE, DELETE` on every user-owned table.
- **anon**: `SELECT` **only** on `trips` and `itinerary_items` (both have `is_published`-gated policies). All other tables must NOT grant anon.

If the audit query in section 1 shows a row missing, add the exact `GRANT` in the same migration. Do not run the bulk loop — we have explicit policies.

---

## 4. Query-shape changes in stores (no schema impact)

### `src/stores/useTripStore.ts`

1. **Stop `SELECT *`** — define explicit column lists like `services/trips.ts` already does. Add `ITINERARY_COLUMNS` and `FLIGHT_COLUMNS` constants and use them in `fetchItineraryItems`, `fetchFlights`, `createItineraryItem(...).select(...)`, and the duplicate-trip clone read.
2. **Pagination guard** — `fetchTrips` and `fetchItineraryItems` add `.limit(500)` with a console warning if `data.length === 500` so we notice when a user crosses the soft cap. Real pagination is Phase B.
3. **Batched updates** — `bulkUpdateItemDates` currently fires N parallel UPDATEs. Replace with a single `rpc('bulk_update_item_dates', { patches: jsonb })` call. Add the RPC in the migration:
   ```sql
   CREATE OR REPLACE FUNCTION public.bulk_update_item_dates(patches jsonb)
   RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
   BEGIN
     UPDATE public.itinerary_items i
        SET date = (p->>'date')::date, updated_at = now()
       FROM jsonb_array_elements(patches) p
      WHERE i.id = (p->>'id')::uuid;
   END $$;
   GRANT EXECUTE ON FUNCTION public.bulk_update_item_dates(jsonb) TO authenticated;
   ```
   RLS still applies because it's SECURITY INVOKER.
4. **Awaiting auth** — `fetchProfile` and every `createX` calls `supabase.auth.getUser()` per write. Cache the user id in the store (`set({ authUserId })`) on the first resolve, and refresh from the `onAuthStateChange` listener already wired in `useAuth.tsx`. Eliminates a network round-trip per mutation.
5. **Remove manual `user_id` filters** — none today, good. Add an ESLint rule (or grep gate) to keep it that way (memory rule already in core).

### `src/components/NotificationsPopover.tsx`

- The current query filters `is_dismissed=false` then sorts by `created_at` — pairs with the new composite index.
- Add `.limit(50)` so the popover never pulls an unbounded list.

### `src/components/workspace/ConciergePanel.tsx`

- Message fetch should `.order("created_at").limit(200)` per conversation.

### `src/stores/useStudioStore.ts`

- `studio_items` fetch: replace `SELECT *` with explicit columns and add `.order("created_at", { ascending: false }).limit(500)`.

---

## 5. Scoped Realtime

Audit every `supabase.channel(...)` subscription:

```bash
rg -n "\.channel\(|postgres_changes" src
```

For each, add a server-side filter so we don't fan out every user's writes to every client:

```ts
.on('postgres_changes',
    { event: '*', schema: 'public', table: 'itinerary_items',
      filter: `trip_id=eq.${tripId}` }, ...)
```

Tables that need a `filter`: `itinerary_items` (by `trip_id`), `notifications` (by `user_id`), `trip_packing_items` (by `trip_id`), `concierge_messages` (by `conversation_id`), `studio_social_imports` (by `user_id`).

---

## 6. Verification checklist

After the migration runs:

1. `supabase--linter` — zero new warnings.
2. `supabase--read_query` — re-run the GRANT audit; confirm `anon` only on `trips`/`itinerary_items`.
3. Manual: open Trip Workspace, watch Network panel — `itinerary_items` fetch should return only declared columns, sub-200ms warm.
4. Drag a card across days, confirm a single `rpc/bulk_update_item_dates` call instead of N updates.
5. `supabase--db_health` — slow-query list should drop the previous top offenders.
6. Update `.lovable/plan.md`: mark A2 complete, list shipped indexes + RPC.

---

## What's NOT in this turn

- A1 auth hardening (Apple/email confirm/MFA) — separate turn.
- Service-layer migration of `itineraryItems`/`notifications` — separate turn (A4).
- Sentry/PostHog wiring — A5.
- Real cursor pagination UI — Phase B.

---

## Execution order

1. Run scans (section 1), paste results into chat.
2. Single migration: indexes + missing GRANTs (if any) + `bulk_update_item_dates` RPC.
3. Edit `useTripStore.ts`, `useStudioStore.ts`, `NotificationsPopover.tsx`, `ConciergePanel.tsx` per section 4.
4. Add filters to all Realtime channels (section 5).
5. Re-run linter + manual smoke; update `.lovable/plan.md`.

Estimated scope: 1 migration, ~5 file edits, no UI changes.
