
## Plan: Travel Network — Social Directory & Dual-Layer Privacy

Build a new `/network` page where users discover other travelers, manage account-level privacy, and request access to private trips. Add a trip-level privacy toggle inside the trip workspace. All state is client-side (Zustand) with mock sandbox users, matching the "Quiet Luxury" aesthetic.

### 1. Header entry point (right-hand profile toolbar only)

Edit `src/components/AppHeader.tsx`:
- In the right-hand actions cluster (next to "Plan w/ Concierge", bell, and profile icon), insert a polished **"Travel Network"** text button.
- Styling: `font-inter` text-xs, muted-foreground default, accent (bronze) on hover, with a small `Users` lucide icon in accent. Same ghost button treatment as "Plan w/ Concierge" for visual consistency.
- On viewports below `md`, collapse to an icon-only `Users` button (44px touch target) so the entry point survives mobile.
- **Do not** add Network to the center nav — entry originates exclusively from the profile toolbar per request.
- Clicking navigates to `/network`.

### 2. New route `/network`

Register in `src/App.tsx` under the `AppLayout` protected route group.

Create `src/pages/Network.tsx` with the editorial layout:

```text
+-----------------------------------------------------+
|  Travel Network                          (Playfair) |
|  Discover other travelers and curators              |
+-----------------------------------------------------+
|  [ 🔍  Search travelers by name... ]                |  ← Search panel
+-----------------------------------------------------+
|  SUGGESTED CONNECTIONS                              |
|  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐             |
|  │ pic  │  │ pic  │  │ pic  │  │ pic  │             |  ← Horizontal snap-scroll
|  │ Name │  │ Name │  │ Name │  │ Name │             |
|  │ 12 T │  │ 4 T  │  │ 9 T  │  │ 2 T  │             |
|  │[Foll]│  │[Req] │  │[Pend]│  │[Conn]│             |
|  └──────┘  └──────┘  └──────┘  └──────┘             |
+-----------------------------------------------------+
|  SEARCH RESULTS  (only when query active)           |
|  ── row tiles, one per match ──                     |
+-----------------------------------------------------+
```

- Canvas: `bg-background` (cream), section panels with `border-thin border-foreground/15` and `rounded-sm` (2px).
- Titles: `font-playfair`, body/metrics/buttons: `font-inter`.
- Mobile: suggestions stay horizontal snap-scroll; search results stack vertically.

### 3. Profile Connection Card

New component `src/components/network/ProfileCard.tsx`, two layouts via `variant: "tile" | "row"` prop:
- Round avatar with initials fallback (sharp 2px square variant available).
- Full name (Playfair 16–18px).
- Metric badge "X Trips Planned" (Inter, muted).
- Tiny privacy chip: `Lock` icon = Private profile, `Globe` icon = Public profile.
- Action button driven by relationship state:
  - `none` + public profile → **Follow**
  - `none` + private profile → **Request Access**
  - `pending` → **Pending** (disabled, muted)
  - `connected` → **Connected** (outline with check)
- Optimistic: store updates immediately on click.

### 4. Dual-layer privacy

**Layer 1 — Profile-level privacy** (account):

Add a "Privacy" section to `src/components/ProfileDrawer.tsx`:
- Switch row "Public Profile" with helper copy.
- When toggled to Private, inline note: "Other travelers will need to request access to view your trips."
- Backed by `networkProfile.isPublic` in the store (client-only for now).

**Layer 2 — Trip-level privacy** (per trip):

Edit `src/components/workspace/MatrixGrid.tsx` header area:
- Add a small `Lock`/`Globe` toggle button near the existing view toggle.
- States: **Public** (visible to your network) / **Private** (hidden from everyone).
- Persisted via existing `updateTrip` using `is_published` semantics (`true` = public, `false` = private). No DB migration.
- Tooltip: "Private trips are hidden even from your connections."

**Handshake modal:**

New `src/components/network/RequestAccessModal.tsx` — confirmation dialog after "Request Access":
> "We've sent your request to {Name}. You'll be notified when they respond."

### 5. Zustand store additions

Extend `src/stores/useTripStore.ts`:

```ts
export type ConnectionStatus = "none" | "pending" | "connected";

export interface NetworkUser {
  id: string;
  name: string;
  avatar_url: string | null;
  trips_planned: number;
  is_public: boolean;
  status: ConnectionStatus;
}

interface NetworkSlice {
  networkProfile: { isPublic: boolean };
  setProfileVisibility: (isPublic: boolean) => void;

  networkUsers: NetworkUser[];          // seeded mock directory
  networkQuery: string;
  setNetworkQuery: (q: string) => void;

  followUser: (id: string) => void;     // sets status -> "connected"
  requestAccess: (id: string) => void;  // sets status -> "pending"
}
```

Selectors:
- `selectSuggestedConnections(state)` → users with `status === "none"`, capped at 6.
- `selectSearchResults(state)` → filtered by `networkQuery` (case-insensitive substring on name).

### 6. Sandbox mock data

New `src/data/mockNetworkUsers.ts` — 5 travelers, alternating privacy:

| Name | Trips | Public? | Initial status |
|---|---|---|---|
| Imogen Voss | 12 | Public | none |
| Marcus Aurelio | 4 | Private | none |
| Saskia Klein | 9 | Public | none |
| Hiroshi Tanaka | 7 | Private | pending |
| Eloise Marchand | 3 | Public | connected |

Seeded into `networkUsers` on store init. All interactions stay in-memory for `/dev-sandbox` demos.

### 7. Files touched

**New**
- `src/pages/Network.tsx`
- `src/components/network/ProfileCard.tsx`
- `src/components/network/RequestAccessModal.tsx`
- `src/data/mockNetworkUsers.ts`

**Edited**
- `src/App.tsx` — add `/network` route
- `src/components/AppHeader.tsx` — "Travel Network" button in right-hand toolbar (NOT center nav)
- `src/components/ProfileDrawer.tsx` — profile privacy switch
- `src/components/workspace/MatrixGrid.tsx` — trip privacy toggle
- `src/stores/useTripStore.ts` — network slice, selectors, mock seed

### Out of scope (next pass)
- Supabase tables/RLS for follows + access requests
- Real notifications when a request is approved
- Network-aware filtering on `PublicTripView` (currently uses share tokens)
