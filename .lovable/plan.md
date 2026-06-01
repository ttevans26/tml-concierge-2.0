## Goals

1. Add a collapse/expand toggle to the left **Studio Folders** sidebar in `TripWorkspace`, matching the Budget sidebar pattern from the previous plan.
2. Fix the **Concierge Inspiration** items (and folder items generally) overflowing the column on narrow screens.

## 1. Collapsible Studio sidebar

Files: `src/pages/TripWorkspace.tsx`, `src/components/workspace/StudioSidebar.tsx`

- In `TripWorkspace`, add `const [studioOpen, setStudioOpen] = useState(true)` persisted to `localStorage` under `tml-studio-open` (mirrors the `tml-budget-open` flag).
- When `studioOpen` is true, render the existing `<StudioSidebar onCollapse={...} />` in its `w-[20%]` column. When false, render a thin `w-10` rail with a vertical "Studio" label and a chevron-right button to expand.
- Add an `onCollapse?: () => void` prop to `StudioSidebar`. Render a small chevron-left icon button in its header (next to the "Studio Folders" title) that calls it. Mobile (`Sheet`) path is unchanged.
- Center matrix column uses `flex-1`, so it expands automatically when either sidebar collapses.

## 2. Fix Concierge Inspiration overflow

File: `src/components/workspace/StudioSidebar.tsx`

The cards overflow because the flex chain from `ScrollArea` → section wrappers → `DraggableStudioItem` is missing `min-w-0`, so long titles/descriptions/badges push the row wider than the sidebar column.

- Add `min-w-0` to the `ConciergeInspirationSection` root (`<div className="border-t border-accent/20 min-w-0">`) and to its inner `px-4 pb-3` and `space-y-1.5` containers.
- Add `w-full min-w-0` to the root `<div>` of `DraggableStudioItem` so the truncate/line-clamp inside actually constrains to the parent width.
- In `DraggableStudioItem`, wrap the price badge with `max-w-[64px] truncate` and keep the existing `shrink-0` to prevent long currency strings from pushing layout.
- Apply the same `min-w-0` fix to the `FolderSection` `AccordionContent`'s inner `space-y-1.5` wrapper for consistency with regular folder items.
- Ensure the outer sidebar container (`<div className="flex h-full flex-col border-r border-border bg-card">`) also gets `min-w-0 w-full` so it never grows past its column.

## Out of scope

- No changes to data fetching, store logic, or the mobile sheet variant.
- No visual restyling beyond width constraints.
