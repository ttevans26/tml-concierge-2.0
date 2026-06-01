## Goals

1. Make the Matrix Grid easy to pan across all day columns without relying on the thin Radix scrollbar.
2. Let the user collapse the right-hand Budget Reserve sidebar to reclaim horizontal space (mirroring the Studio sidebar collapse already in place).

## 1. Better horizontal pan in MatrixGrid

File: `src/components/workspace/MatrixGrid.tsx`

- Replace the Radix `ScrollArea` wrapper around the matrix with a plain native scroll container (`overflow-auto`). This gives the browser's normal scrollbar plus full gesture support (trackpad two-finger, shift+wheel, touch swipe).
- Add **click-and-drag panning** on the scroll container via a ref + mouse handlers: on mousedown record `startX` / `scrollLeft`, on mousemove update `scrollLeft = startX - e.clientX`, release on mouseup/leave. Skip drag-pan when the pointer starts on an interactive element (`button`, `a`, `input`, `[draggable="true"]` itinerary card, or `[data-no-pan]`) so card drag-and-drop and clicks still work. Cursor flips to `grab` / `grabbing`.
- Convert vertical mouse-wheel scrolling over the grid into horizontal scroll when the user isn't holding Shift — typical horizontal-timeline UX.
- Add a small **day-navigation strip** pinned in the existing grid header (right side, next to the view toggle): `‹` previous day, `Today`/`Jump to start`, `›` next day. Buttons call `scrollBy({ left: ±176, behavior: "smooth" })` (matching the `w-44` day column width). Disabled at the ends.
- Keep the sticky left category column and sticky day-header row working — native scroll respects `position: sticky` the same way.

## 2. Collapsible Budget Reserve sidebar

Files: `src/pages/TripWorkspace.tsx`, `src/components/workspace/BudgetSidebar.tsx`

- In `TripWorkspace`, add `const [budgetOpen, setBudgetOpen] = useState(true)` persisted to `localStorage` under `tml-budget-open` (mirrors `tml-studio-open`).
- When `budgetOpen` is true, render the existing `<BudgetSidebar onCollapse={...} />` in its current `w-[20%]` column. When false, render a thin `w-10` rail with a vertical "Budget" label and a chevron-left button to expand.
- Add an `onCollapse?: () => void` prop to `BudgetSidebar`. Render a small chevron-right icon button in its header (next to "Budget Reserve") that calls it.
- The center matrix column already uses `flex-1 min-w-0`, so it grows automatically when the sidebar collapses — no width math needed.
- Mobile (`lg:hidden`) behavior unchanged.

## Out of scope

- No changes to data fetching, the Zustand store, drag-and-drop logic, or visual design tokens.
- Calendar view (`CalendarStaysView`) is unchanged.
