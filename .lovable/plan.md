## Goal
Seed the existing Antibes Studio folder (`4e83194e-37f1-41cd-9e92-c3d1bbcfb099`, owner `7eb8a562-…`) with 5 new `studio_items`. Each will include `lat`/`lng` so the Proximity Map renders pins immediately.

## Items to insert

| Title | Category | Approx. Address | Lat / Lng |
|---|---|---|---|
| Le Fricot | dining | 12 Rue des Bains, 06600 Antibes | 43.5810, 7.1255 |
| Azul Café | dining | 14 Cours Masséna, 06600 Antibes | 43.5807, 7.1259 |
| La Torref de Fersen | dining | Place du Révely, 06600 Antibes | 43.5809, 7.1247 |
| Bistrot du Coin | dining | 5 Rue Frédéric Isnard, 06600 Antibes | 43.5803, 7.1250 |
| Le Sentier du Littoral, Cap d'Antibes | activity | Cap d'Antibes, 06160 | 43.5556, 7.1297 |

Notes:
- All cafés/restaurants map to the `dining` category (matches `CATEGORY_META` in `StudioSidebar.tsx` and `classifyPlace()`).
- The coastal trail maps to `activity`.
- `google_place_id` left null; users can later trigger Places validation in Studio to enrich `api_metadata`. Coordinates are best-effort so the Proximity Map and distance ranking work right away.

## Execution (build mode)

Single `INSERT` via the supabase insert tool into `public.studio_items`, populating `folder_id`, `user_id`, `category`, `title`, `address`, `lat`, `lng`, and a short `description`. No schema migration, no code changes.

## Out of scope
- No new components or UI changes.
- No Google Places API calls (can be done later via existing Studio entity-validation flow).
- No changes to the proximity logic — items rendering on the map relies only on the existing `lat`/`lng` fields, which this insert provides.
