# Port Ideas Vault Folders to thomas26evans@gmail.com

## Source data found

User `Thomas Anderson` (7eb8a562…) owns 4 Studio folders with items that match what you described:

| Folder | Location | Items |
|---|---|---|
| Antibes | Antibes, FR | 6 |
| Provence | Provence, France | 5 (this is your St Rémy folder) |
| Lake Garda | Garda, IT | 8 |
| UK | Bath, UK | 4 |

Target user `thomas26evans@gmail.com` (8684caf3…) has none of these.

## Change

Single `INSERT` data operation (no schema change):

1. Clone the 4 `studio_folders` rows into the target user's account, generating new IDs and preserving `name` / `location`.
2. Clone all `studio_items` belonging to those source folders into the new target folders, generating new IDs and preserving every field (title, description, address, lat/lng, url, cost, google_place_id, api_metadata, etc.).
3. Leave the source folders untouched.

Done as one CTE-based insert keyed by a folder-name map so the items land in the correct new folder.

## Result

Signing in as thomas26evans@gmail.com will show the Antibes, Provence (St Rémy), Lake Garda, and UK (Bath) folders in the Ideas Vault with all 23 items intact.
