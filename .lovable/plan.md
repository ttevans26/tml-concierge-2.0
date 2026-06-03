## Make trip start date directly clickable on the grid

Today there is a `Trip starts: Aug 20, 2026 ▾` popover, but it sits as small gray text next to the pan controls — easy to miss. The user expects to click the start date itself.

### Change

In `src/components/workspace/MatrixGrid.tsx`, wrap the **first day-header cell** (the `EEE, MMM d` label of the leftmost column, currently a plain `<span>` at line ~1011) in the same `Popover` + `Calendar` that already powers the inline shift. Selecting a new date computes `delta` and calls the existing `shiftTripDates(activeTrip.id, delta)` — no store or DB changes.

Visual treatment for the first column only:
- Cursor `pointer`, subtle dotted underline under the label, a tiny `Pencil` (or `ChevronDown`) icon to the right.
- Hover: background tint `bg-accent/10`, foreground turns to `text-accent` to signal "editable anchor".
- Tooltip: `Click to shift entire trip to a new start date`.
- All other day headers stay non-interactive.

Keep the existing `Trip starts: …` popover in the pan toolbar as a secondary affordance (some users will look there). No other layout changes.

### Validation
- Clicking the first column header (currently `Thu, Aug 20`) opens a calendar; picking Aug 14 shifts every itinerary item by −6 days and the date header redraws as `Thu, Aug 14`.
- Picking the same date is a no-op; toast confirms `Trip shifted -6 days`.
- Other day columns remain non-clickable.

### Files
- `src/components/workspace/MatrixGrid.tsx` — wrap first day header in Popover/Calendar; reuse existing handler.
