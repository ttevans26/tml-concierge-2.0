## Goal

Replace the plain text inputs for **New Collection → "General Location"** (`src/components/studio/StudioVault.tsx`) and **New Journey → "Destination"** (`src/components/CreateTripDialog.tsx`) with a real Google-style place autocomplete: type → see predictions → click one to fill the field.

## Approach

Build one reusable component, `src/components/ui/PlaceAutocomplete.tsx`, and use it in both dialogs. Keeps behavior identical and means future location fields can drop it in.

### Component contract

```ts
<PlaceAutocomplete
  value={string}
  onChange={(v: string) => void}            // raw text changes (typing)
  onSelect={(p: PlacePick) => void}         // user picked a suggestion
  placeholder?: string
  types?: "cities" | "regions" | "establishment" | undefined  // bias
  id?: string
/>

interface PlacePick {
  description: string;   // e.g. "Provence, France"
  placeId: string;
  mainText: string;      // "Provence"
  secondaryText: string; // "France"
}
```

### Implementation

- Reuse the existing `loadGoogleMapsScript()` from `src/lib/googleMaps.ts` (already includes the `places` library and uses the connector's referrer-allowed key).
- Use **Places API (New)** as required by the connector knowledge — not legacy `Autocomplete`:
  ```ts
  const { AutocompleteSuggestion, AutocompleteSessionToken } =
    await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
  const sessionToken = new AutocompleteSessionToken();
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input, sessionToken, includedPrimaryTypes: [...], // when types prop set
  });
  ```
- Debounce input ~200ms; require min 2 chars.
- Rotate a single `AutocompleteSessionToken` per "edit session" (reset on select) for billing correctness.
- Render a popover/list below the input using the existing shadcn `Command`/`Popover` pattern already used elsewhere — quiet-luxury styling (cream bg, onyx text, bronze hover, 2px radii, 0.5px borders).
- Keyboard: ↑/↓ to move, Enter to pick, Esc to close. Click-outside to close.
- Mobile: 44px min touch target per memory rule.
- Free-text fallback: if the user keeps typing and hits Enter without picking a suggestion, the parent still gets the raw string via `onChange` — no forced selection. This preserves the current "manual" flow as a safety net.

### Wire-up

1. **`CreateTripDialog.tsx`** (Destination field): swap the `<Input>` for `<PlaceAutocomplete value={destination} onChange={setDestination} onSelect={(p) => setDestination(p.description)} types="cities" placeholder="e.g., Mexico City" />`. No DB schema change — still stores the description string in `trips.destination`.
2. **`StudioVault.tsx`** (General Location field): same swap, but `types="regions"` so users get regions/cities ("Provence", "South of France") instead of restaurants. Stores description string in `studio_folders.location`.

### Out of scope

- No DB changes. We're not persisting `place_id`/lat/lng on the folder or trip in this pass (can be a follow-up if useful for the Proximity Map default center).
- No changes to other location inputs (FIND A PLACE, item creation forms). They already use their own search flows.
- No styling overhaul of either dialog beyond the input swap.

## Files touched

- **Add** `src/components/ui/PlaceAutocomplete.tsx` — reusable component.
- **Edit** `src/components/CreateTripDialog.tsx` — swap Destination input.
- **Edit** `src/components/studio/StudioVault.tsx` — swap General Location input.
