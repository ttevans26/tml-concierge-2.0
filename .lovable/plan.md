## Goal

Mirror the Location row's pill UI on the Stays row. A hotel stay should render as a single pill that spans every night it covers (just like a location leg spans its dates), instead of one card per day cell. The Location row already shows city/state/country correctly — no changes there.

## Behavior

- A stay item already has a check-in date (`date`) and check-out via `metadata.end_date` (or `metadata.checkout_date`). The pill spans from check-in day through the night before check-out (i.e. last-night cell), matching the existing "X nights" semantics used by `buildSegments`.
- Pills render as an absolutely-positioned overlay over the Stays row, identical styling system to Location pills (thin border, accent tint, truncate, rounded-sm, height fits row).
- Multiple stays may overlap the same night (we already removed the 1-stay lockout). Overlapping pills stack vertically inside the Stays row; row height grows to fit (min height preserved).
- Empty day cells in the Stays row still show the "+ Add" affordance so users can add a new stay on any uncovered day.
- Clicking a pill opens the existing `EditItemDialog` for that stay (same dialog used today when you click a stay card).
- Hover shows hotel name + date range + nights in `title` tooltip.

## Out of scope (Stays row only — other rows untouched)

- Dining, Activity, Logistics rows keep their per-cell card layout.
- No drag-to-resize on the pills (matches current Location pill behavior).
- No schema changes.

## Technical Plan

**Files to edit**

- `src/components/workspace/MatrixGrid.tsx`
- `src/lib/locationLegs.ts` (extend with a generic `stayColumnSpan` helper, or add a sibling `getStayPills` util — see below)

**New helper: `getStayPills(items, tripStart)`**

In `src/lib/locationLegs.ts` (or a new `src/lib/stayPills.ts` if cleaner), export:

```ts
interface StayPill {
  id: string;           // itinerary_items.id
  startDate: string;    // check-in (yyyy-MM-dd)
  endDate: string;      // last night occupied (yyyy-MM-dd) — checkout minus 1
  nights: number;
  title: string;
  item: ItineraryItem;
}
```

Logic:
- Filter `category === "stays"` with a `date`.
- `endDate = metadata.end_date ?? metadata.checkout_date ?? date`; if it's a checkout date (exclusive), subtract 1 day to get the last-night cell. Fallback to `date` (1-night stay) if metadata missing.
- Sort by `startDate`.

Reuse the existing `legColumnSpan(tripStart, { startDate, endDate })` for positioning math — it's already generic.

**MatrixGrid changes**

1. Compute `stayPills = useMemo(() => getStayPills(itineraryItems, activeTrip?.start_date), [...])`.
2. Compute lane assignment to stack overlapping pills:
   - Greedy: for each pill (sorted by start), pick the lowest lane index whose last pill's `endDate < this.startDate`.
   - Track `maxLane`; Stays row height = `Math.max(112, (maxLane + 1) * 28 + 8)` (currently `h-28` = 112px).
3. Render a second absolute overlay (sibling to the existing leg overlay) positioned over the Stays row. The Stays row's `top` offset within the day-columns wrapper = header(40) + location(36) = 76px. Height matches the dynamic Stays row height.
4. Inside the Stays row's per-day cell loop:
   - Remove the per-day stay cards from the cell render (skip rendering for `cat.key === "stays"` cellItems).
   - Keep the "+ Add" button so users can still seed a new stay on any day.
   - Keep the cell background (`bg-[hsl(var(--cell-stays))]`) intact.
5. Pills are styled like location pills:
   - `border border-accent/60 bg-accent/15 text-foreground hover:bg-accent/25 rounded-sm px-2.5`
   - Height ~24-26px, vertical gap 2px between lanes
   - Icon: `Bed` (lucide) instead of `MapPin`
   - Label: `{title} · {nights}n`
6. Click → set state opening `EditItemDialog` with that item. (Dialog is already lazy-loaded elsewhere in the app; import + wire a small local state for it here.)

**Visual diagram**

```
┌──────────┬─────────┬─────────┬─────────┬─────────┐
│ LOCATION │ [────── Paris, IDF, FR · 3n ──────]   │  ← existing
├──────────┼─────────┼─────────┼─────────┼─────────┤
│ STAYS    │ [── Hôtel Bourg · 3n ──]              │  ← new spanning pill
│          │ + Add    + Add    + Add    + Add      │
├──────────┼─────────┼─────────┼─────────┼─────────┤
│ LOGISTICS│  …per-cell cards (unchanged)…         │
└──────────┴─────────┴─────────┴─────────┴─────────┘
```

**Edge cases**

- Stay extending past trip end: clip `width` using the same `Math.min(span, days.length - startIdx)` logic as legs.
- Stay starting before trip start: skip (consistent with current leg overlay behavior).
- Stays without `metadata.end_date`: render as 1-night pill spanning just `date`.
- Conflict highlight: if `conflictIds.has(item.id)`, add a red ring (`ring-1 ring-destructive/60`) on the pill.

## Validation

- Existing Location pill row continues to render unchanged.
- Adding a stay via the existing AddItemDialog flow produces a pill spanning the correct nights.
- Clicking the pill opens the edit dialog and saves correctly.
- Other category rows (Dining/Logistics/Activity) are visually unchanged.
