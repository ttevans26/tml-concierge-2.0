

## Plan: Calendar Month View for Trip Stays

Add a new "Calendar" view toggle to the Trip Workspace that displays stays as colored bars across a month grid — like Apple Calendar's month view — so users can see at a glance where they are sleeping each night and where transitions happen.

### What the user gets

- A view-mode switcher in the Matrix Grid header: **Matrix** (current horizontal grid) ⟷ **Calendar** (new month view).
- The Calendar view shows the trip's date range laid out as a standard 7-column month grid (Sun–Sat), with multiple weeks stacked vertically.
- Each unique stay (e.g., "Hôtel du Cap-Eden-Roc", "Villa La Mauresque") renders as a continuous colored bar spanning all the consecutive nights it occupies, with the location name written inside the bar.
- Each distinct stay/location gets its own color, deterministically assigned from a refined palette (sage, dusty rose, slate, terracotta, lavender, ochre, etc.) tuned to the Quiet Luxury aesthetic.
- **Overlap handling**: on transition days (checkout of one stay = check-in of another), both bars appear stacked in the same day cell with a subtle gradient overlap, so the handover is visually clear.
- Clicking a bar opens the existing `EditItemDialog` for that stay.
- Days outside the trip range are dimmed; days inside but with no stay show a subtle "—" placeholder.

### Visual reference

```text
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Sun │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ ··· │ ··· │  3  │  4  │  5  │  6  │  7  │
│     │     │ ▓▓▓▓▓▓▓ Eden-Roc ▓▓▓▓▓▓▓▓▓▓▓│
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  8  │  9  │ 10  │ 11  │ 12  │ 13  │ 14  │
│ ▓▓▓ Eden-Roc ▓▓│▒▒▒▒▒▒ Mauresque ▒▒▒▒▒▒│
│        (overlap on day 10)              │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

### Scope

In scope:
- New Calendar month view component for stays.
- View toggle in MatrixGrid header.
- Stay-grouping logic that collapses per-night `itinerary_items` into contiguous ranges by `title` + `location_name`.
- Deterministic color palette assignment per unique stay.
- Click-to-edit on bars.
- Mobile responsive (stacks into a vertical agenda-style list under `sm`).

Out of scope (can follow up):
- Showing dining/activity/logistics items in the calendar (stays only for v1, matching the "where am I sleeping" mental model).
- Drag-to-resize stay durations from the calendar (use Edit dialog for now).
- Cross-month trips spanning calendar boundaries — handled but rendered as a continuous multi-week grid covering only the trip's span (no full empty months).

### Technical details

**New file**: `src/components/workspace/CalendarStaysView.tsx`
- Props: none (reads `activeTrip` and `itineraryItems` from `useTripStore`).
- Build week rows using `date-fns` (`startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `differenceInCalendarDays`) covering `trip.start_date` through `trip.end_date`, padded to whole weeks.
- Group stays: filter `itineraryItems` where `category === "stays"`, sort by `date`, then collapse consecutive dates with the same `title` (fallback `location_name`) into `{ key, title, startDate, endDate, items[], colorIndex }` segments.
- Color assignment: hash the stay's `title` to an index into a curated 8-color HSL palette defined in `tailwind.config.ts` extension or inline (muted sage `142 25% 55%`, terracotta `15 45% 60%`, slate `215 20% 50%`, ochre `40 50% 55%`, dusty rose `350 30% 65%`, lavender `260 25% 60%`, teal `185 30% 50%`, bronze `36 45% 50%`).
- Rendering: CSS Grid with 7 columns per week row. Each week renders day-number cells in one layer, and stay bars in an absolutely-positioned overlay layer spanning `grid-column: start / end+1`. Bars get rounded-left if they're the segment start in that week, rounded-right if the end, square otherwise (handles wrapping across week boundaries).
- Transition overlap: when two segments share a date (checkout = next check-in), render the outgoing segment ending at `day + 0.5` and the incoming starting at `day + 0.5` using a `grid-template-columns: repeat(14, 1fr)` half-day trick OR layer two bars with `clip-path: polygon` for a diagonal split. Use the polygon approach for cleaner Apple-Calendar-style diagonal handover.
- Bar height: `~22px`, stacked if multiple bars in same row (rare beyond the transition case).
- Click handler: `onClick={() => setEditingItem(segment.items[0])}` opens `EditItemDialog`.
- Mobile (`<sm`): replace the 7-col grid with a vertical agenda list grouped by stay segment, each shown as a colored card with date range and night count.

**Edit**: `src/components/workspace/MatrixGrid.tsx`
- Add `viewMode` state (`"matrix" | "calendar"`), persist to `localStorage` keyed `tml-view-mode`.
- Add a small segmented toggle in the header (using existing `Tabs` or a two-button group styled to match), placed left of the Smart Pull button.
- When `viewMode === "calendar"`, render `<CalendarStaysView />` in place of the scrollable matrix; keep the header, Smart Pull tray, and dialogs intact.

**No DB changes.** All data comes from the existing per-night stay records.

**No new dependencies.** Uses `date-fns` (already installed), Tailwind, Lucide.

### Files touched

- `src/components/workspace/CalendarStaysView.tsx` (new)
- `src/components/workspace/MatrixGrid.tsx` (add view toggle + conditional render)

