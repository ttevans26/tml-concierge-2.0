## Goal
Add a trip-association selector to the "Plan w/ Concierge" modal so users can optionally tie the appointment to one of their existing trips (for live collaboration) — or leave it unattached for preliminary ideation.

## Changes

**File: `src/components/SchedulingModal.tsx`**

1. **Pull trips from the store**:
   - Import `useTripStore` and select `trips`.
   - New state: `const [tripId, setTripId] = useState<string>("none")` where `"none"` represents "No trip — exploratory session".

2. **New "Trip Context" section** in Column 3 (Agenda), above the Textarea:
   - Label: `Trip Context` (same uppercase-tracking style as the Agenda label).
   - Use the existing shadcn `Select` component:
     - First option: `No trip — exploratory ideation` (value `"none"`).
     - Then one option per trip: `{trip.name}` with a secondary line showing `{destination} · {start–end dates}` formatted via `date-fns` if both dates exist.
   - Below the select, render a tiny helper line:
     - If `"none"`: `"The concierge will help you brainstorm from scratch."`
     - If a trip is selected: `"Concierge will have live view-access to this trip during the call."` (Bronze accent text).

3. **Toast + reset**:
   - Append trip context to the confirmation toast description:
     - With trip: `"…at 10:30 AM PST · linked to {trip.name}."`
     - Without: `"…at 10:30 AM PST · exploratory session."`
   - Reset `tripId` back to `"none"` along with the existing state resets on confirm.

4. **Layout polish**:
   - Column 3 stays a single flex column; the new Trip Context block sits above Agenda with `gap-4`, matching the existing rhythm.
   - No changes to columns 1 or 2.

## Out of scope
- Persisting the appointment or trip link to the backend.
- Granting the concierge real access to the trip data.
- Filtering trips by status (all user trips are listed).
