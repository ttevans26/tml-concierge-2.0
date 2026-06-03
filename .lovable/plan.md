## Goal
Let users extend the trip end date directly from the Matrix Grid header in two ways:

1. **End-date pill** next to the existing "Trip starts:" pill — click → calendar popover → updates `trips.end_date`.
2. **Sheets-style "+" column** at the right edge of the day columns — click → appends one day (sets `end_date = lastDay + 1`). Hold-friendly (multiple clicks = multiple days).

## Changes (frontend only — `src/components/workspace/MatrixGrid.tsx`)

### 1. End-date pill (header strip)
Right after the existing "Trip starts:" Popover (~line 798):
- Add a sibling `Popover` showing `Trip ends: {format(end_date, "MMM d, yyyy")}` with a `CalendarIcon` + `ChevronDown`.
- `<Calendar mode="single">` with `disabled={{ before: parseISO(activeTrip.start_date) }}` so the end can never precede the start.
- On select: `await updateTrip(activeTrip.id, { end_date: format(d, "yyyy-MM-dd") })`, then toast `"Trip extended through MMM d"` / `"Trip shortened to MMM d"` based on delta.
- If shrinking would orphan items, the existing `OrphanItemsBanner` already handles surfacing them — no extra logic needed.

### 2. Trailing "+ Add day" column (Google Sheets style)
At the end of the `days.map(...)` loop (after the closing `})}` around line 1187), render one additional column sized identically to a day column (`w-44 shrink-0`):
- Replace the day-header cell with a centered ghost button: `+ Add day`.
- Body rows show subtle empty placeholders (dashed border or muted bg) so it visually matches but reads as inactive.
- Click handler:
  ```ts
  const nextEnd = format(addDays(parseISO(activeTrip.end_date), 1), "yyyy-MM-dd");
  await updateTrip(activeTrip.id, { end_date: nextEnd });
  toast.success(`Added ${format(addDays(parseISO(activeTrip.end_date), 1), "MMM d")}`);
  ```
- Also extend the overlay widths (`days.length * 176`) automatically since `days` recomputes from the new `end_date`.

### 3. Header subtitle
The line `{days.length} day{days.length !== 1 ? "s" : ""} · {format(days[0], "MMM d")} — {format(days[days.length - 1], "MMM d, yyyy")}` stays — it updates automatically once `end_date` changes.

## Out of scope
- No prepend ("+" at the start) — start-date pill already covers shifting / extending backwards via the existing trip-shift flow.
- No new business rules; orphan handling is already wired.
- No backend / migration changes; `trips.end_date` already exists and `updateTrip` is already in `useTripStore`.

## Files
- `src/components/workspace/MatrixGrid.tsx` (single edit)
