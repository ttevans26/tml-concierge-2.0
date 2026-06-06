## Goal
Stop the Matrix Grid from feeling cramped on large monitors. The 3-column workspace already uses `flex-1`, but the grid's day columns are hard-coded to 176px, so extra horizontal space goes unused and the grid still scrolls. Make the whole layout — side panels, header, and especially the day columns — scale with the available viewport.

## What's wrong today
- `src/pages/TripWorkspace.tsx` side panels: Studio left = `w-[20%] min-w-[220px]`, Right tabs = `w-[22%] min-w-[260px]`. Fine in spirit, but they have no max, so on ultra-wide screens they steal too much; on mid screens they're not generous enough.
- `src/components/workspace/MatrixGrid.tsx`: `COL_WIDTH = 176` and every cell uses `w-44` / inline `width: days.length * 176`. The center pane is `flex-1 min-w-0` but the grid never measures it, so it always renders at `days * 176px` and horizontally scrolls.
- Stay-bar widths (lines ~1104, 1154, 1184, 1202, 1209) all multiply by the hard-coded 176.

## Plan

### 1. Fluid day columns in MatrixGrid
- Add a `ResizeObserver` (or a small `useElementWidth` hook in `src/hooks/`) on the scroll container to track available width.
- Compute `colWidth = clamp(MIN_COL, available / days.length, MAX_COL)` where `MIN_COL = 140` (preserves current readability on small screens) and `MAX_COL = 280` (prevents absurd stretching on 4K).
- When `days.length * MIN_COL > available`, fall back to horizontal scroll (current behavior on narrow screens).
- Replace the hard-coded `176` constant and every `w-44` day-cell class with an inline `style={{ width: colWidth }}`. Replace `days.length * 176` math (header row, stay overlay rows, "add" empty row) with `days.length * colWidth`.
- Keep the 96px sticky left label column as-is (it's a label, not data).

### 2. Tighten side-panel scaling in TripWorkspace
- Studio sidebar: keep `w-[20%] min-w-[220px]`, add `max-w-[320px]`.
- Right sidebar: keep `w-[22%] min-w-[260px]`, add `max-w-[360px]`.
- Result: on ultra-wide displays the side panels stop growing and the extra width is donated to the Matrix Grid center pane, which then expands its columns via step 1.

### 3. Header + Trip Health Bar
- They already span full width; no change needed. Verify no `max-w-*` wrappers are introduced.

### 4. QA
- Resize preview to 1280, 1440, 1920, 2560 widths and confirm: columns grow up to ~280px, no horizontal scroll appears until day count × 140 exceeds center pane width, stay bars still align with their day cells, sticky left label stays pinned.
- Spot-check on 1024 (lg breakpoint) and below `lg` (mobile single-pane) — mobile path unchanged.

## Technical notes
- Files touched: `src/pages/TripWorkspace.tsx`, `src/components/workspace/MatrixGrid.tsx`, plus a tiny new `src/hooks/useElementWidth.ts`.
- No schema, store, or API changes. Pure presentational.
- `COL_WIDTH` constant becomes derived state; anywhere it's referenced (header row, stay overlay positioning math, add-row width) reads the live value from the hook so multi-day stay bars resize correctly when the viewport changes.
- `ReadOnlyMatrixGrid` (network view) is out of scope unless you also want it fluid — flag if yes.

## Out of scope
- Changing the row layout, category list, or vertical sizing.
- Touching dialogs, ConciergePanel internals, or studio cards.
