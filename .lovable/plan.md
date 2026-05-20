## Plan: Connections Repository + Friend Profile & View-Only Trip

Add a left-hand "Connections" repository to the Travel Network page, then deepen the social flow with friend profile pages and a redacted, read-only trip view.

### What the user gets

1. **Left sidebar on `/network`** — a "Your Connections" repository listing everyone you follow (status: `connected`). Each row shows avatar, name, and "X Trips Planned" — the same tile metadata as the directory cards.
2. **Click a connection → `/network/user/:id`** — a friend's profile page with their avatar, name, trip count, privacy chip, and a grid of trips they've made visible to you.
3. **Click one of their trips → `/network/user/:id/trip/:tripId`** — a view-only Matrix-style trip view showing dates, location, stays, dining, activities, logistics — **with all sensitive fields redacted** (no cost, no points, no confirmation codes, no cancellation deadlines, no credit-card / booking refs).

### Layout — `/network` (revised)

Desktop (≥ md): two-column shell inside the existing max-w-5xl canvas.

```text
+--------------------------------------------------------+
| Travel Network                                         |
+-----------------+--------------------------------------+
| Your            |  Find a traveler  [search]           |
| Connections (N) |--------------------------------------+
|  • Eloise M.    |  Suggested Connections               |
|  • Imogen V.    |  [tile] [tile] [tile] ...            |
|  • Marcus A.    |                                      |
+-----------------+--------------------------------------+
```

Mobile: connections collapse into a horizontal snap-scroll strip above the search panel (so the existing single-column flow is preserved on the 964-px viewport down to phones).

### Friend profile — `/network/user/:id`

- Header: avatar (initials fallback), Playfair name, privacy chip (Globe/Lock), "X Trips Planned".
- "Trips visible to you" section: card grid of mock trips. Each card shows trip name, destination, date range, and a Stays/Dining/Activity count strip.
- If `is_public === false` and status !== `connected`: show a locked state with "Request Access" CTA (re-uses existing modal).
- Back link to `/network`.

### View-only trip — `/network/user/:id/trip/:tripId`

Layout mirrors the existing Matrix Grid visual language (Day columns × category rows) but renders a **`ReadOnlyMatrixGrid`** that:

- Uses the same category color tokens and cell layout as `MatrixGrid` / `PublicTripView`.
- Renders simplified read-only cards showing **only**: title, location_name, date, start_time/end_time, short description.
- **Hides**: `cost`, `currency`, `points_used`, `confirmation_code`, `cancellation_deadline`, `source_reference`, `api_metadata`, any badge tied to loyalty/credit cards.
- Header shows trip name, destination, date range, and a small "Viewing as guest — financial details hidden" notice in the bronze accent treatment.
- No edit affordances, no Smart Pull, no Concierge button, no Studio sidebar.

### State & mock data (sandbox-only, no DB changes)

`src/stores/useTripStore.ts` additions:

- `NetworkTripSummary` type: `{ id, owner_id, name, destination, start_date, end_date, item_counts: { stays, dining, activity, logistics } }`.
- `NetworkTripItem` type: redacted shape — `{ id, trip_id, category, title, description, date, start_time, end_time, location_name }`. **No cost/points/confirmation fields exist on this type at all**, so the read-only view physically cannot leak them.
- `networkUserTrips: Record<userId, NetworkTripSummary[]>` and `networkTripItems: Record<tripId, NetworkTripItem[]>`.
- Selectors: `selectConnections`, `selectUserById`, `selectVisibleTripsForUser(id)`, `selectTripItems(tripId)`.

`src/data/mockNetworkTrips.ts` (new): 2–3 trips for Eloise (connected) and Imogen (public), each with ~6–10 redacted itinerary items spread across categories and days. Marcus/Hiroshi (private/pending) get an empty list so the locked profile state is demonstrable.

### Components & routes

New:
- `src/components/network/ConnectionsList.tsx` — left rail / mobile strip; reuses avatar + name + trips_planned styling from `ProfileCard`.
- `src/components/network/UserTripCard.tsx` — trip summary card for the profile page.
- `src/components/network/ReadOnlyMatrixGrid.tsx` — redacted Day × Category grid renderer.
- `src/pages/NetworkUserProfile.tsx` — `/network/user/:id`.
- `src/pages/NetworkUserTrip.tsx` — `/network/user/:id/trip/:tripId`.
- `src/data/mockNetworkTrips.ts`.

Edited:
- `src/pages/Network.tsx` — two-column layout, mount `ConnectionsList`.
- `src/stores/useTripStore.ts` — add types, mock-backed slices, selectors.
- `src/App.tsx` — register the two new protected routes inside `AppLayout`.

### Design tokens

Strict adherence to the Savvy Elite Editorial system already in use: cream canvas, 0.5px Onyx borders, 2px radii, Playfair headers, Inter body, bronze accent on the "guest view" notice and category chips. No new colors introduced.

### Out of scope

- Real Supabase tables / RLS for friend trips (mock-only for now; existing `itinerary_items_public` view stays untouched).
- Real-time updates, comments, reactions.
- Editing or duplicating a friend's trip into your own.
