## Tools Page Density Refinement

### Goal
Reduce excessive vertical scrolling on the Tools page by compressing spacing and downsizing headline fonts, so the key content (Preparedness Checklist + Travel Warnings) becomes visible without scrolling.

### Changes

**1. `src/pages/Tools.tsx` — Page-level tightening**
- Reduce top padding from `py-8 md:py-12` to `py-4 md:py-6`.
- Reduce `<header>` bottom margin from `mb-10 md:mb-12` to `mb-6 md:mb-8`.
- Shrink headline: `text-3xl md:text-5xl` → `text-2xl md:text-4xl`.
- Shrink subtitle: `text-sm md:text-base` → `text-xs md:text-sm`.
- Reduce trip selector top margin from `mt-6` to `mt-4`.
- Reduce section divider (`border-t-thin`) bottom margin from `mb-10` to `mb-6`.

**2. `src/components/tools/UpcomingAppointments.tsx` — Section tightening**
- Reduce internal padding/margins by ~30% (heading margins, list item gaps).
- Keep the same information density but remove excess whitespace between rows.

**3. `src/components/tools/PreparednessChecklist.tsx` — Section tightening**
- Compress header spacing and reduce checklist item vertical padding.
- Tighten gap between checklist items.

**4. `src/components/tools/TravelWarningsFeed.tsx` — Section tightening**
- Compress header spacing and reduce card/list item vertical padding.
- Tighten gap between warning entries.

### Outcome
The Tools page will feel more information-dense and utilitarian — more "dashboard," less "landing page." All content should fit within a single viewport on desktop, with minimal scroll on mobile.