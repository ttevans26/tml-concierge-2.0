## Goal
Make the "Plan w/ Concierge" modal demo-ready with realistic dummy availability, and display the user's timezone (defaulting to PST) so slots are clearly anchored in time.

## Changes

**File: `src/components/SchedulingModal.tsx`**

1. **Dummy availability map** (module-level constant):
   - `AVAILABILITY: Record<string, string[]>` keyed by `yyyy-MM-dd` → array of slot strings drawn from existing `TIME_SLOTS`.
   - ~20 bookable dates across the next 6 weeks, skipping weekends and a few weekdays.
   - Vary per day: some morning-only, some afternoon-only, some full day, some with just 2–3 "limited" slots.
   - Add an `AVAILABILITY_UPDATED_AT` string for subtle demo polish.

2. **Timezone display (default PST)**:
   - Add constant `DEFAULT_TZ = "America/Los_Angeles"` with display label `"PST"`.
   - Show a small timezone chip in the modal header area, right-aligned in the DialogHeader row: e.g. `Globe` icon + `Times shown in PST (Los Angeles)`.
   - Also show the TZ label inline next to the selected date in the time-slot column header: `Thu, Jun 4 · PST`.
   - Keep it static for now (no picker); leave a `// TODO: detect via Intl.DateTimeFormat().resolvedOptions().timeZone` comment so it's easy to wire to real geolocation later.
   - Include the TZ in the confirmation toast: `"Concierge session on Jun 4, 2026 at 10:30 AM PST."`

3. **Calendar gating**:
   - Replace `disabled={(d) => d < new Date()}` with a combined function that also disables dates not present in `AVAILABILITY`.
   - Add `modifiers={{ available: [...] }}` + `modifiersClassNames` so available dates get a subtle Bronze Beige dot/underline.

4. **Time slot column**:
   - Render only `AVAILABILITY[dateKey]` slots instead of the full list.
   - Show "Limited availability" caption when ≤3 slots remain.
   - Preserve the existing "Select a date" empty state.

5. **Microcopy**:
   - DialogDescription → "Book a 30-minute planning session. Availability updated hourly."

## Out of scope
- Real timezone detection / user-selectable picker
- Persisting bookings to backend
- Real consultant calendar integration
