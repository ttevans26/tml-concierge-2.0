## Plan: Tools Workspace — Warnings Engine + AI Checklist

Build the missing `/tools` route and populate it with two flagship widgets: a contextual Real-Time Travel Warnings feed and a dual-track Pre-Travel Preparedness Checklist with AI backfills. All work is client-side (Zustand + mock data), in keeping with MVP `/dev-sandbox` scope.

### What the user gets

A new `Tools` page with a two-column editorial layout (stacks on mobile):

- **Trip selector** at the top — chooses which trip in `useTripStore.trips` drives the contextual filtering (defaults to the next upcoming or `activeTrip`).
- **Left / main column — Pre-Travel Preparedness Checklist**
  - Track A: manual entries with add input, toggle checkbox, inline edit, delete.
  - Track B: "✨ Suggested Logistics Insights" — AI-backfilled items rendered with a subtle bronze-beige `✨` glyph, italic Playfair subtext explaining the rationale (e.g., IDP rule for Italy), and an "Accept" affordance that promotes them into Track A as a confirmed task. Dismiss hides for that trip.
  - Backfill rules derived from `itineraryItems` of the selected trip:
    - Car rental in IT/ES/JP (logistics item whose title/description matches `car|rental|hertz|avis|sixt|europcar` and whose location resolves to those countries) → "Obtain an International Driving Permit (IDP)".
    - Any stay/logistics in EU country list → "Verify biometric passport valid 3+ months past return date" + EES/ETIAS note.
    - Trip duration > 7 days → "Arrange mail / package hold".
    - Trip start within 14 days and no logistics item containing `flight|airline` → "Confirm online check-in window".
- **Right column — Real-Time Travel Warnings Engine**
  - Card list filtered to warnings whose `regions` intersect the selected trip's destinations AND whose `valid_from/valid_to` overlap the trip dates.
  - Card anatomy: small uppercase Inter category eyebrow ("REGULATORY", "HEALTH", "ENVIRONMENTAL"), Playfair headline, 2–3 line Inter body, muted-amber 0.5px left border for advisories and forest-green (`#1B3022`) left border for regulatory/info. No red, no banners, no fills.
  - Empty state: short serif line "No active advisories for this itinerary."

### Visual rules (strict)

- Cream `#FDFCF8` bg, Onyx `#1A1A1A` text, Bronze Beige `#9B7E4B` accents, 0.5px borders, 2px radii.
- Playfair for all headers / item titles; Inter for body, labels, checkboxes.
- Whitespace-forward: section gap `space-y-10`, card padding `p-6`, no shadows beyond `shadow-sm`.
- Warning accent colors added as semantic tokens in `index.css`: `--warning-forest: 145 30% 15%` and `--warning-amber: 38 55% 50%`.
- Fully responsive: single column under `md`, two columns at `md+`.

### Mock data (sandbox)

A new `src/data/mockTravelWarnings.ts` exports a typed array of ~6 warnings spanning regulatory (EU EES/ETIAS, UK ETA), health (regional advisory), and environmental (heatwave/strike). Each entry has `id`, `category`, `title`, `body`, `severity` (`info | advisory`), `regions` (ISO country codes + free-text region match), `valid_from`, `valid_to`, `source_label`.

### State (Zustand)

Extend `useTripStore` with:

```ts
interface ChecklistTask {
  id: string;
  trip_id: string;
  task_text: string;
  is_completed: boolean;
  is_ai_generated: boolean;
  context_trigger?: string;
  detail?: string; // explanatory subtext for AI items
  dismissed?: boolean;
}

checklistTasks: ChecklistTask[];
addChecklistTask(input): void;
toggleChecklistTask(id): void;
updateChecklistTask(id, patch): void;
deleteChecklistTask(id): void;
acceptAiTask(id): void;   // flips is_ai_generated=false, keeps text
dismissAiTask(id): void;  // sets dismissed=true
```

All ops are optimistic and local — no Supabase writes in this pass (matches MVP/sandbox guidance). State seeded with mock manual + AI tasks in dev-sandbox.

### Backfill logic

Pure derivation in `src/lib/checklistBackfill.ts`:

```ts
deriveAiTasks(trip, itineraryItems): ChecklistTask[]
```

Runs in a `useMemo` inside the checklist component, merged with stored AI tasks so dismiss/accept state persists per trip. Rule registry is a small array of `{ id, predicate, build }` for easy extension.

### Warning filtering

`src/lib/warningFilter.ts` exports `filterWarningsForTrip(warnings, trip, itineraryItems)` doing:

- Region match: warning.regions intersects destinations collected from `trip.destination` + `itineraryItems[].location_name` (string contains, case-insensitive) or country codes derived from a small built-in city→country map for the demo (covers Italy, France, Spain, UK, Japan, USA — enough for sandbox).
- Date match: warning window overlaps `[trip.start_date, trip.end_date]`.

### Files

- `src/App.tsx` — add `/tools` route inside protected layout.
- `src/pages/Tools.tsx` (new) — page shell, trip selector, two-column grid.
- `src/components/tools/PreparednessChecklist.tsx` (new) — Tracks A + B, accept/dismiss/toggle/add.
- `src/components/tools/TravelWarningsFeed.tsx` (new) — filtered list, editorial cards.
- `src/lib/checklistBackfill.ts` (new) — rule registry + derivation.
- `src/lib/warningFilter.ts` (new) — region/date overlap helpers + city→country map.
- `src/data/mockTravelWarnings.ts` (new) — seed advisories.
- `src/stores/useTripStore.ts` — extend with `checklistTasks` + CRUD/accept/dismiss; seed mock manual tasks for sandbox.
- `src/index.css` — add `--warning-forest`, `--warning-amber` tokens (light + dark).
- `tailwind.config.ts` — surface them as `warning-forest` / `warning-amber` colors.

### Out of scope (next pass)

- Supabase table + RLS for `checklist_tasks` (sandbox-only for now; trivial to add when promoted out of MVP).
- Live geopolitical/health feed integrations (Travel.State.Gov, WHO, FCDO) — mock now, edge function later.
- Per-user dismissal persistence across sessions (kept in-memory for this pass).
