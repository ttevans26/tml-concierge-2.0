## Goal

Fill the dead vertical space below the Matrix Grid on tall screens without breaking small/short viewports. Approach: **rows grow continuously up to a cap, then a slim Trip Pulse strip absorbs any remainder.** No abrupt breakpoint — everything scales with available height.

## Layout math

Available space = `MatrixGrid` flex container height (excludes header, toolbar, date row, daily totals footer, scrollbar). We measure it via a `useResizeObserver` on the scroll container.

```
ROW_MIN   = 96px   (today's compact 112px minus a touch)
ROW_MAX   = 160px  (cap — beyond this, rows feel sparse)
PULSE_MIN = 0px    (fully hidden when no remainder)
PULSE_MAX = 140px  (compact strip)
```

Per frame:
1. `targetRowH = clamp((available - chrome) / 4, ROW_MIN, ROW_MAX)`
2. `remainder = available - chrome - targetRowH * 4`
3. `pulseH = clamp(remainder, 0, PULSE_MAX)`

Stays row is already special-cased (`staysRowHeight` for stacked location + stay pills); keep its multiplier ratio against `targetRowH` (today it's `2 * baseRowH + gap`). Apply same scaling factor.

Result: between ~720–950px tall the rows just stretch; above ~950px the Pulse strip fades in and absorbs the rest; the matrix never starves on short screens.

## Changes

### 1. `src/components/workspace/MatrixGrid.tsx`
- Add a `useResizeObserver` (or `ResizeObserver` directly) on the scroll container ref to track `availableHeight`.
- Compute `rowHeight` + `pulseHeight` per the math above; memoize.
- Replace the hard-coded `112px` in row `style.height` (and corresponding logistics/dining/activity row heights, lines ~1101, ~1364) with `${rowHeight}px`.
- Recompute `staysRowHeight` using `rowHeight` as the base.
- Pass `pulseHeight` to a new `<TripPulseStrip />` rendered as the last row of the scroll container (below the Daily $ footer) so it scrolls horizontally in sync. Hide entirely when `pulseHeight < 32`.

### 2. `src/components/workspace/TripPulseStrip.tsx` (new)
A single-row strip aligned to the day columns. Contents (read-only, derived from existing store + `gapDetection`):
- **Daily $ sparkline** — tiny bar per day, height-proportional to daily total, tinted with the active category colors. Already have `dailyTotals`.
- **Gap pips** — small dot per day where `gapsByDate(iso)` has any entry, colored by highest severity.
- **Anchor markers** — small Landmark icon glyph on days that contain a stay anchor (read from `staysByNight`).

Quiet Luxury treatment: 0.5px border-top, cream bg, Onyx text at 60%, bronze accent on hover, no animations beyond a 150ms fade-in when it appears. Tooltip on hover shows the day's totals and gap labels.

### 3. `src/pages/TripWorkspace.tsx`
No structural change — the matrix already lives in `flex-1 min-w-0`. Just verify the scroll container fills `100%` height inside that flex slot (it already does via `flex-1 overflow-auto`).

## Behavior on shrink

- As the window narrows in height, `rowHeight` and `pulseHeight` both shrink continuously.
- Below the Pulse min-render threshold (32px), the strip simply unmounts — no jank, the grid takes back the space immediately.
- Below `ROW_MIN`, rows hit the floor and the existing internal scroll kicks in. Today's behavior.

## Out of scope

- No new interactive features in the Pulse strip (no click-to-edit, no drag); it's a glanceable overview only.
- No changes to mobile single-panel layout — pulse strip only renders on `lg:` breakpoints where the matrix is the center panel.
- No changes to header, sidebars, or footer.
