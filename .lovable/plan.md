## Header Visual Hierarchy Refinement

Establish a clear 3-tier size hierarchy in `AppHeader.tsx` (and the Bell trigger in `NotificationsPopover.tsx`):

**Tier 1 — Brand (largest)**: `TML Concierge`
- Bump from `text-base sm:text-xl` → `text-xl sm:text-2xl`.
- Increase seal padding slightly (`px-4 py-2 sm:px-5 sm:py-2.5`) and tracking for presence.

**Tier 2 — Primary Nav**: `Trips`, `Studio`, `Tools`
- Bump from `text-sm sm:text-base` → `text-base sm:text-lg`, weight `font-semibold` when active, switch family to `font-playfair` to differentiate from utility actions and reinforce editorial feel. Increase horizontal padding `px-5 sm:px-6`.

**Tier 3 — Utility Actions (smallest)**: `Travel Network`, `Plan w/ Concierge`, Bell, Profile
- Keep text labels at `text-xs` (current) but reduce icon-button footprint from `h-10 w-10` → `h-9 w-9`, and icons from `h-4 w-4` → `h-3.5 w-3.5` so they read as clearly subordinate.
- Reduce inline icon size next to text labels to `h-3 w-3`.

**Header bar**
- Slightly increase header height to accommodate the larger brand and nav: `h-16 sm:h-20` → `h-18 sm:h-24` (using `h-[72px] sm:h-24`).

### Files to edit
- `src/components/AppHeader.tsx`
- `src/components/NotificationsPopover.tsx` (Bell trigger sizing only)

### Out of scope
No behavior, routing, or color-token changes — purely visual hierarchy.