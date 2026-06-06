## Goal

Trim gap analysis to **only trip-disrupting** issues. Visible-in-grid noise (dining, free blocks) goes away.

## Kept gap kinds (3)

1. **`no_stay`** (high) — a night with no accommodation. Already span-aware after the last fix.
2. **`missing_transit`** (medium) — stay city changes day-over-day with no `logistics` item on the travel day.
3. **`stay_gap`** (high, new) — a checkout-night with no follow-on stay before the next booked stay starts (orphan night between two different stays). Reported on each uncovered night between them.

## Removed

- **`no_dining`** — visible in the empty Dining row.
- **`free_block`** — visible in the empty Agenda row; not trip-breaking.

## Changes

### `src/lib/gapDetection.ts`
- Update `GapKind` union: drop `"no_dining" | "free_block"`, add `"stay_gap"`.
- Delete the no-dining and free-block branches inside the day loop.
- Refine the stay-coverage logic: walk days; when a night has no stay coverage, classify as either:
  - `no_stay` when no stay exists on adjacent nights, OR
  - `stay_gap` when the previous and/or next planned stay are in *different* cities (i.e. an orphan between two segments). Detail copy: "Gap between {prevCity} and {nextCity} — no stay on {date}." Seed prefills `location_name` with the nearest upcoming stay city to bias the AI prompt.
- `missing_transit` branch stays as is (already span-aware via expanded stays).
- `computeHealthScore`: keep stay weight; drop the activity/dining weight contribution so the score reflects only critical coverage. Renormalize possible/earned accordingly.

### `supabase/functions/concierge-chat/index.ts` (`toolFindGaps`)
- Remove `missing_dinner` and `empty_day` branches from the gaps array.
- Mirror the same `no_stay` / `stay_gap` distinction using the already-built `staysByNight` set plus a parallel `stayCityByNight` map.
- Keep the response `proposal.type = "find_gaps"` shape; the `gaps[].type` union shrinks to `"no_stay" | "stay_gap" | "missing_transit"`. Add `missing_transit` detection here too (currently absent) so the concierge tool matches the client-side analyzer.

### Downstream
- `TripHealthBar.tsx` and any consumer of `Gap`/`GapKind`: scan for switch/match on the removed kinds and clean up. (Quick rg pass during build.)
- `ProposalCard` rendering for `find_gaps`: no schema change; the same "Add draft" affordance works for the new `stay_gap`.

## Out of scope

- No UI redesign of the gaps panel itself — it just gets quieter.
- No new severity levels or filters/toggles (per answer #2).
- No changes to budget, route, or other Phase 2 tools.
