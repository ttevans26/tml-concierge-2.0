# TML Concierge -- Implementation Plan

## Confirmed Understanding

I have reviewed the PRD, database schema, and user flow from the Knowledge Base. Here is what I will build:

- **App Name**: TML Concierge
- **Aesthetic**: "Savvy Elite Planning" -- Cream (#FDFCF8), Onyx (#1A1A1A), Bronze Beige (#9B7E4B), Playfair Display headers, Inter body, 0.5px borders, 2px radii, generous white space
- **Auth**: Supabase Auth with Zero-Verification flow (immediate JWT, no email confirmation for MVP)
- **Core Layout**: Three-panel workspace (Ideas Vault | Matrix Timeline | Logistics Sidebar)
- **State**: Zustand store (`useTripStore`) for trips, itinerary items, and budget calculations
- **Database**: profiles, trips, itinerary_items, itinerary_items_public (view), flight_tracking, trip_access_requests, tml_core_tenets, user_roles

---

## Step-by-Step Plan

### Phase 1: Foundation & Design System
1. **Install dependencies**: `zustand`, `@supabase/supabase-js`, Google Fonts (Playfair Display + Inter via `index.html`)
2. **Update design tokens** in `index.css` and `tailwind.config.ts`: cream background, onyx foreground, bronze accent, 2px border-radius, 0.5px border utilities
3. **Create `project_plan.md`** at project root for reference

### Phase 2: Supabase Setup
4. **Connect Supabase** to the project
5. **Create database migrations**:
   - `user_roles` table (enum: admin, user) with `has_role()` security definer function
   - `profiles` table (preferences, active_cards, loyalty_memberships) with auto-create trigger
   - `trips` table (dates, locations, is_published, budgets)
   - `itinerary_items` table (category, cost, points_used, cancellation_deadline, approval_status, source_reference)
   - `itinerary_items_public` view (strips cost + confirmation_code)
   - `flight_tracking` table
   - `trip_access_requests` table
   - `tml_core_tenets` table
   - RLS policies for all tables
6. **Create Supabase client** (`src/integrations/supabase/client.ts`) and type definitions

### Phase 3: Authentication
7. **Auth pages**: Login and Signup pages with Zero-Verification flow (email + password, no confirmation required for MVP)
8. **Auth context/hook**: `useAuth` hook using `onAuthStateChange` + `getSession`
9. **Protected route wrapper**: Redirect unauthenticated users to login
10. **Password reset flow**: Forgot password page + `/reset-password` route

### Phase 4: Core UI Shell
11. **App layout component**: Full-viewport layout with responsive three-panel structure
    - Mobile: Single panel with bottom tab navigation to switch panels
    - Desktop: Resizable three-column layout using `react-resizable-panels`
12. **Left Panel -- Ideas Vault**: Empty state with placeholder for URL paste input and draggable idea cards
13. **Center Panel -- Master Timeline Matrix**: Horizontal scrolling grid with category rows (Stays, Logistics, Dining, Agenda) and date columns; includes the Strategic Budget Bar at the top
14. **Right Panel -- Logistics Sidebar**: Collapsible sidebar showing trip details, flight tracking placeholder, and quick-action buttons
15. **Dashboard page**: Post-login landing showing trip list with "Create Trip" action

### Phase 5: Zustand State Management
16. **`useTripStore`**: Zustand store managing:
    - Active trip and itinerary items (CRUD)
    - Splurge Engine calculations (total spend, remaining budget, splurge credit)
    - `/dev-sandbox` mode flag that intercepts Supabase calls and uses local state
17. **Trip creation flow**: Modal/drawer to set trip name, dates, location, and budget

### Phase 6: Routing
18. **Routes**: `/login`, `/signup`, `/reset-password`, `/dashboard`, `/trip/:id` (workspace), `/` (redirect based on auth state)

---

## File Structure (New Files)

```text
src/
├── integrations/supabase/  -- client, types
├── stores/tripStore.ts     -- Zustand store
├── hooks/useAuth.ts        -- Auth hook
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        -- Three-panel shell
│   │   ├── IdeasVault.tsx       -- Left panel
│   │   ├── MatrixTimeline.tsx   -- Center panel
│   │   ├── LogisticsSidebar.tsx -- Right panel
│   │   └── MobileNav.tsx        -- Bottom tabs (mobile)
│   ├── auth/
│   │   ├── ProtectedRoute.tsx
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   ├── trip/
│   │   ├── TripCard.tsx
│   │   ├── CreateTripModal.tsx
│   │   └── BudgetBar.tsx
│   └── matrix/
│       ├── MatrixGrid.tsx
│       ├── MatrixRow.tsx
│       └── MatrixCell.tsx
├── pages/
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── ResetPassword.tsx
│   ├── Dashboard.tsx
│   └── TripWorkspace.tsx
supabase/migrations/
└── 001_initial_schema.sql
project_plan.md
```
