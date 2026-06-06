## Problem

The Matrix Grid renders a stay as a single pill spanning every night it covers (using `metadata.end_date`, e.g. "Bonsoir Madame · 3n" covering Aug 14–16). The gap detector, however, only inspects each item's `date` field (the check-in night), so every subsequent night is incorrectly flagged as "No accommodation." Same bug exists in the concierge `find_gaps` tool and the `prevStayCity` travel-day check.

## Fix

Expand each stay across the nights it actually covers before evaluating per-day gaps — mirroring the Matrix Grid's existing logic (`nights = end - start + 1`, inclusive).

### 1. `src/lib/gapDetection.ts`
- Before building `byDate`, pre-process stays: for each `category === "stays"` item, read `metadata.end_date`; for each ISO date in `[date … end_date]` insert a "virtual stay" reference into `byDate`. Non-stay items unchanged.
- `stays.length === 0` check then correctly reports nights with no coverage.
- Update the travel-day logic: derive `todayCity` from any stay covering that night (already handled once stays are expanded). Suppress the "missing transit" gap when the previous night's stay still covers today (no actual move).
- Apply the same span expansion in `computeHealthScore` so the trip health % stops being dragged down by phantom missing-stay nights.

### 2. `supabase/functions/concierge-chat/index.ts` (`toolFindGaps`)
- Also select `metadata` from `itinerary_items`.
- Build a `staysByNight` Set by expanding each stay across `date … metadata.end_date` (defensive `try/catch`, default to single night when `end_date` missing or malformed).
- Replace the `hasStay = dayItems.some(...)` check with `staysByNight.has(d)`.

### 3. Verification
- Re-open the trip in the screenshot (Bonsoir Madame 3n from Aug 14, Airbnb St Remy 5n from Aug 17). After the fix:
  - Aug 14, 15, 16 → covered by Bonsoir Madame, no "No accommodation".
  - Aug 17–21 → covered by Airbnb St Remy.
  - Only truly uncovered nights (and the no-dining/free-block gaps) remain.
- Confirm trip health % rises accordingly and the concierge "Find gaps in my itinerary" tool returns the same corrected list.

## Out of scope
No schema or UI changes — purely a logic fix in the two gap-evaluation paths.
