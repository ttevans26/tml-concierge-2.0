## Goal
Persist scheduled concierge appointments and surface them in the Tools page so the user has one canonical "Upcoming Appointments" view alongside their other preparedness tools.

## Why Tools (not Profile drawer)
- Appointments are an operational planning artifact, not a profile/identity item — they sit naturally next to Preparedness & Travel Warnings.
- Tools is a top-level tab with room to render rich cards (date, time, TZ, linked trip, agenda). The profile drawer is narrow (320px) and ephemeral.
- The profile drawer will still get a small "Upcoming: 2" entry that links to Tools, so it's discoverable from anywhere.

## Changes

**1. `src/stores/useTripStore.ts` — appointments state (client-side, demo)**
- Add type:
  ```ts
  export interface ConciergeAppointment {
    id: string;
    date: string;          // yyyy-MM-dd
    slot: string;          // "10:30 AM"
    timezone_label: string;// "PST"
    trip_id: string | null;
    trip_name: string | null;
    agenda: string;
    created_at: string;
  }
  ```
- Add to store: `appointments: ConciergeAppointment[]`, `addAppointment(input)`, `cancelAppointment(id)`.
- Seed with 1 dummy upcoming appointment so the demo isn't empty on first load.

**2. `src/components/SchedulingModal.tsx`**
- On Confirm, call `addAppointment({ ... })` with the selected date, slot, TZ, trip, agenda.
- Keep the existing toast.

**3. New: `src/components/tools/UpcomingAppointments.tsx`**
- Reads `appointments` from the store, sorted by date+slot, filters to today-forward.
- Empty state: small "No upcoming sessions" card with CTA button that opens the SchedulingModal.
- Each appointment renders as a Quiet Luxury card:
  - Left: date block (day-of-week, big day number, month) in Playfair.
  - Right: time + TZ chip, agenda preview (line-clamp-2), and either `Linked to {trip_name}` (Bronze) or `Exploratory session` (muted).
  - "Cancel" ghost button (calls `cancelAppointment`, toast confirmation).
- Header row: "Concierge Sessions" + small "Schedule" button that opens the SchedulingModal locally.

**4. `src/pages/Tools.tsx`**
- Add a new section above the existing trip-filtered grid:
  ```
  <UpcomingAppointments />
  ```
  Separated by a `border-thin border-foreground/15` divider. This section is trip-independent (lives outside the "Select a trip" gating).

**5. `src/components/ProfileDrawer.tsx`** (small addition)
- In the nav block (between Travel Preferences and Travel Network), add a "Concierge Sessions" link with `CalendarClock` icon and a count badge showing upcoming appointment count. Clicking navigates to `/tools`.

## Out of scope
- Persisting appointments to Supabase (client-side only for the demo).
- Rescheduling / editing existing appointments.
- Calendar invites / email confirmations.
