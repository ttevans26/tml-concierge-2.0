## Recommended approach: keep both, stack them

Two distinct creation flows deserve two distinct inputs — they solve different problems and shouldn't be collapsed:

| Bar | Purpose | When you reach for it |
|---|---|---|
| **Find a Place** (new, Google Places) | Add a known, real-world venue with full metadata (coords, photo, rating, hours, website) in one tap | "I want to save Le Cap Eden Roc to Antibes" |
| **Import via URL** (existing) | Pull inspiration from outside the web — articles, Instagram, TikTok, Maps share links — that may yield 1+ unstructured items needing review | "Condé Nast just published 12 best villas in Provence" |

Stacking them keeps the mental model clean: **structured search on top, freeform inspiration below**. Merging into one bar would force a heuristic (URL vs query) that breaks on edge cases (e.g. "Hôtel du Cap" is a valid query *and* a search-engine result). Two bars = zero ambiguity.

Replace the top-right "+ Add Item" button entirely. The dialog stays as a fallback (the Places autocomplete falls back to the manual form when no result is selected, just like today's Maps-URL flow).

## Final layout (Workbench header area)

```text
┌──────────────────────────────────────────────────────────┐
│  Antibes                              [⚓ Sort] [⋯ Anchor]│  ← header (Add Item button removed)
├──────────────────────────────────────────────────────────┤
│  FIND A PLACE                                             │
│  🔍 [Search Google for hotels, restaurants…    ] [ + ]   │  ← NEW primary bar
├──────────────────────────────────────────────────────────┤
│  IMPORT VIA URL                                           │
│  🔗 [Paste article, Instagram, Maps link…      ] [✨]    │  ← existing, demoted
├──────────────────────────────────────────────────────────┤
│  Review Scraped Items (only when pending)                 │
├──────────────────────────────────────────────────────────┤
│  Stays · Dining · Activities · Sites (category lanes)     │
└──────────────────────────────────────────────────────────┘
```

## How "Find a Place" works

1. **Typing** triggers `useGooglePlaces.search(query)` (already exists, debounced 250ms). The folder's `location` is appended as a `locationBias` hint so "Le Marché" in the Antibes folder returns the Antibes one first.
2. **Predictions drop down** as a styled list under the input — main text, secondary address, subtle category icon. Click a row to select it.
3. **Selected state** replaces the input value with the place name, locks the field, and shows the place's address as a sub-line. The `+` button activates.
4. **Click `+`** → call `getDetails(placeId)` to fetch full metadata (already implemented in the hook), auto-classify category from Google `types[]` (see mapping below), then `addItem(folder.id, {...})` with coords, photo, rating, website, hours all populated. Toast: *"Added Le Marché to Antibes — categorized as Dining."*
5. **No selection?** Pressing `+` with raw text opens the existing `AddStudioItemDialog` with the title prefilled (same pattern as today's Maps URL fallback). User picks category manually.
6. **Category override.** Below the input show a tiny pill row: `Auto · Stays · Dining · Activity · Sites`. Default is `Auto`; clicking a pill forces the category and overrides the auto-classifier. This is the answer to "what if Google says it's an `establishment` and I want it as a Site."

### Auto-classification from Google Place types

Google returns a `types` array on every place. Map first match wins:

```text
lodging, hotel, resort, bed_and_breakfast       → stays
restaurant, cafe, bar, bakery, meal_*, food     → dining
tourist_attraction, museum, art_gallery,         → sites
  landmark, church, park, point_of_interest
everything else (spa, store, gym, etc.)         → activity
```

Toast surfaces the choice so the user notices ("…categorized as **Dining**. [Change]") with a quick action that opens the item's edit dialog.

## Files to change

- `src/components/studio/StudioWorkbench.tsx`
  - Remove the "+ Add Item" header button.
  - Insert new **Find a Place** section above the existing URL Ingestor, mirroring its 0.5px border / muted label styling.
  - Add `categoryOverride` state (`'auto' | StudioCategory`) and pill row.
  - Add `selectedPlaceId` state; render predictions dropdown sourced from `useGooglePlaces`.
  - Wire `+` button → `getDetails` → classify → `addItem`, fallback to opening `AddStudioItemDialog` with prefill when no selection.
- `src/lib/placeCategory.ts` *(new)* — pure helper `classifyPlace(types: string[]): StudioCategory` containing the mapping above. Easy to unit-test and reuse later (e.g. URL ingestor could call it too).
- `src/hooks/useGooglePlaces.ts` — small addition: accept an optional `locationBias` (lat/lng or string) so the autocomplete prioritizes results near `activeFolder.location`. Today it only takes `types`.

## Edge cases handled

- **No active folder** → both bars hidden (existing empty state still shows).
- **Google Maps script not yet loaded** → input shows "Loading places…" placeholder and disables the `+` button until `useGooglePlaces` becomes ready (the hook already exposes a load signal via `serviceRef`).
- **Duplicate place** → before insert, check if `activeFolder.items` already has an item with the same `google_place_id`; if so, toast *"Already in this collection"* and skip.
- **API failure on getDetails** → fall back to inserting with just the autocomplete prediction's `description` as title and `main_text` address; no silent failure.

## Out of scope

- Backfilling categories for items added before this change.
- Multi-select / bulk-add from autocomplete (one place at a time keeps the UX honest).
- Replacing the manual `AddStudioItemDialog` — it stays for typed-only entries and as the fallback when Places has no match.
- Server-side input validation (Google Places already normalizes; we're not storing raw user text in privileged contexts).
