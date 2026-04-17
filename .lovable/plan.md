# Mobile Responsiveness Audit & Plan

**Goal:** Optimize the app for mobile (≤ `md`, primarily ≤ `sm`) **without changing the desktop design or any business logic**. Use Tailwind/shadcn breakpoints only (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

**Non-goals:** No visual redesign on desktop. No state, routing, or data flow changes. No new features.

---

## 1. Audit — Current Issues by Screen

### A. App Shell (`AppHeader.tsx`, `AppLayout.tsx`)
- ✅ Header already hides nav (`sm:flex`) and "Plan w/ Concierge" (`sm:inline-flex`) on mobile.
- ❌ **Brand → nav is hidden on `<sm` with no replacement** — user has no way to reach `/studio` or `/tools` from mobile. Need a mobile menu (sheet) trigger.
- ❌ Header right cluster icon buttons are `h-8 w-8` (32px). Memory rule requires **44px touch targets** on mobile.

### B. Dashboard (`pages/Index.tsx`)
- ✅ Card grid is responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- ⚠️ Header `flex items-end justify-between` with `text-3xl` H1 + button can crowd 320–375px. Consider stacking on `<sm`.

### C. Trip Workspace (`pages/TripWorkspace.tsx`)
- ❌ **Critical:** Both side panels use `hidden ... lg:block`, so on `<lg` the user sees **only the Matrix Grid** — no access to Studio Sidebar or Budget Sidebar.
- `StudioSidebar` already has its own mobile sheet (FAB at `bottom-20 left-4`), but because `TripWorkspace` wraps it in `hidden lg:block`, **the mobile sheet never renders on mobile**.
- `BudgetSidebar` has no mobile equivalent → completely inaccessible on phones/tablets.

### D. Studio Page (`pages/Studio.tsx`)
- ❌ **Critical:** `ResizablePanelGroup direction="horizontal"` with three panels (22/48/30) is unusable on mobile — three panels squeezed into 375px gives ~80px each. Resizable handles are also hard to touch.
- ❌ Map (`StudioMap`) at ~80px wide is meaningless.

### E. StudioWorkbench (`components/studio/StudioWorkbench.tsx`)
- ⚠️ Header row: title block + "Sort by Proximity" + "Add Item" buttons on a single flex row may overflow `<sm`.
- ⚠️ Pending Review tray rows pack: icon + title + Select(w-24) + 2 icon buttons → cramped on narrow viewports.
- ⚠️ Touch targets: small icon buttons (`p-1` ≈ 24px).

### F. StudioVault & StudioSidebar
- ✅ StudioSidebar already supports mobile via `Sheet`.
- ⚠️ FolderRow delete button `hidden ... group-hover:block` is unreachable on touch (no hover).

### G. Modals & Dialogs
- shadcn Dialog default width OK on mobile. Will spot-fix only if overflow observed.

### H. MatrixGrid
- Horizontal-scroll spreadsheet is intentional. **No structural change.**

### I. Auth pages
- Centered card layouts, likely fine. Touch only if broken on `375px`.

---

## 2. Solution — Per-File Plan

Strict rule: **mobile-only additions** via `<sm`/`<md`/`<lg` classes. **Never** alter existing `lg:`/`md:`/`sm:` classes that drive desktop layout, except where adding a missing mobile fallback (e.g., removing `hidden lg:block` and replacing with a Sheet trigger that's `lg:hidden`).

### 1) `src/components/AppHeader.tsx` — Mobile nav menu
- Add a `Menu` icon button visible only on `<sm` (`sm:hidden`) on the **left** beside the brand, opening a `Sheet` (side="left") containing the nav items + "Plan w/ Concierge".
- Keep desktop layout untouched.
- Bump icon buttons to `h-10 w-10` on `<sm` only (`h-10 w-10 sm:h-8 sm:w-8`).

### 2) `src/pages/TripWorkspace.tsx` — Make sidebars reachable on mobile/tablet
- Remove `hidden lg:block` wrappers; render `StudioSidebar` and `BudgetSidebar` directly. Each component decides via `useIsMobile()` whether to render inline (desktop) or as a Sheet trigger (mobile).
- Layout: keep `lg:w-[20%]` widths exactly. On `<lg`, Matrix Grid takes full width and the two sidebars become floating Sheet triggers (FABs).

### 3) `src/components/workspace/BudgetSidebar.tsx` — Add mobile Sheet (mirror StudioSidebar pattern)
- Wrap content with `useIsMobile()`. On mobile: render a fixed FAB at `bottom-20 right-4` (Wallet icon) → opens bottom Sheet with the existing BudgetSidebar contents.
- On desktop: unchanged.

### 4) `src/pages/Studio.tsx` — Mobile tabs replace 3-column resizable
- On `<lg`, replace `ResizablePanelGroup` with shadcn `Tabs` (Vault / Workbench / Map), each filling height. Sticky tab list at top.
- On `lg+`, render the existing `ResizablePanelGroup` exactly as today.

### 5) `src/components/studio/StudioWorkbench.tsx` — Mobile-friendly header & rows
- Header: `flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`.
- Action buttons row: wrap on `<sm` (`flex-wrap`).
- Pending Review rows: `flex-wrap` with `min-w-0` on the title block.
- Bump icon buttons (accept/dismiss) from `p-1` to `p-2` on mobile.

### 6) `src/components/studio/StudioVault.tsx` — Touch-visible delete
- Change `hidden ... group-hover:block` to `block sm:hidden sm:group-hover:block`.

### 7) Modals — Verify & spot-fix only if overflow
- Add `max-h-[90vh] overflow-y-auto` minimally where needed. Don't preemptively change all dialogs.

### 8) MatrixGrid — Verify only
- Confirm horizontal scroll works on touch. No structural changes unless regression observed.

---

## 3. Order of Implementation

1. `AppHeader` — mobile menu sheet (unblocks nav on phones).
2. `TripWorkspace` — remove `hidden lg:block` wrappers.
3. `BudgetSidebar` — add mobile Sheet + FAB.
4. `Studio` page — Tabs on `<lg`, ResizablePanelGroup on `lg+`.
5. `StudioWorkbench` — header wrapping + touch targets.
6. `StudioVault` — visible delete on touch.
7. Manual QA at `360`, `375`, `768`, `1024`, `1311`.

---

## 4. Risks & Mitigations

- **Risk:** Changing `TripWorkspace` wrappers could affect desktop layout. **Mitigation:** Keep `lg:w-[20%]` widths exactly; mobile branches use `fixed` FABs that don't take flow space.
- **Risk:** Tabs on Studio page change UX on tablet. **Mitigation:** Use `lg:` breakpoint (1024px) — wide tablets in landscape get desktop, portrait tablets get tabs.
- **Risk:** Touch target bumps could shift desktop spacing. **Mitigation:** Use `sm:`-prefixed sizes so desktop sizes are explicitly preserved.
