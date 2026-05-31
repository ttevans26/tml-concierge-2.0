# Auto-Pin Saved Items on the Proximity Map

## Problem

"La Trattoria" is saved in the dining folder but has `lat`, `lng`, and `google_place_id` all `NULL` in the database. The Proximity Map only pins items that already have coordinates. The existing "Re-sync" button under "Missing Coordinates" works, but the user has to click it manually for every item.

The map should silently look up missing coordinates via Google Places and pin them on its own.

## Solution

Add a background auto-heal pass to `StudioMap` so any saved item without coordinates is resolved through Google Places on folder load, persisted to the database, and pinned without user interaction. The existing manual Re-sync row stays as a visible fallback for items that fail.

## Changes

### `src/components/studio/StudioMap.tsx`
- After the map initializes and `activeFolder` changes, build a queue of items where `getCoords(item) === null`.
- Process the queue sequentially with a ~400 ms gap between calls (avoids Places quota spikes).
- For each item, reuse the same lookup the Re-sync button uses today:
  1. `PlacesService.findPlaceFromQuery` with `"{title}, {folder.location}, {address?}"`.
  2. Fallback to `geocodeAddress(address || query)`.
- On success: update `studio_items` (`lat`, `lng`, `google_place_id`, `address`, `api_metadata.rating/user_ratings_total/photo_url`) and call `fetchFolders()` so the marker effect re-runs and drops the pin.
- On failure: leave the item in the "Missing Coordinates" list so the manual Re-sync button still works.
- Guard with a per-mount `Set<itemId>` so an item is never auto-healed twice in the same session and the queue cancels cleanly when the user switches folders.
- No toasts for auto-heal (silent); manual Re-sync keeps its toasts.

### `src/lib/googleMaps.ts`
- Extract the lookup-and-persist logic currently inlined in `ResyncRow.handleResync` into a shared helper:
  ```ts
  export async function healItemCoordinates(item: StudioItem, folderLocation: string): Promise<{ lat: number; lng: number } | null>
  ```
- `ResyncRow` and the new auto-heal effect both call this helper. Keeps a single source of truth for the Places → DB write path.

## Out of Scope
- Backfill migration for other items with missing coords (the auto-heal pass will catch them on next folder open).
- Switching from legacy `PlacesService` to Places API (New).
- Any visual redesign of the map or the Missing Coordinates list.

## Expected Result
Opening `/studio` → Antibes folder loads → map centers on Antibes → within ~1 s La Trattoria's pin appears with no clicks, and its row disappears from the "Missing Coordinates" list.
