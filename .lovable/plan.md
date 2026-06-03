# Fix empty Reshuffle Locations popover

## Diagnosis

My previous change made `buildSegments()` in `src/lib/segments.ts` ignore Stays that don't have a `location_name` set. For trips whose stays still only have `title` (e.g. the seeded/sandbox data on this trip), every day collapses into a single "Unassigned" segment, so `baseSegments.length < 2` and the popover renders the empty-state message.

That fix solved duplicate-Paris bands but at the cost of breaking the common case where `location_name` simply hasn't been entered yet.

## Fix

Restore the title fallback in `buildSegments`, but with a normalization step so duplicate cities still collapse:

1. For each Stay day, compute `label = location_name?.trim() || title?.trim() || "Stay"` (same as original).
2. After building consecutive runs, merge **adjacent** segments whose normalized labels match by either:
   - shared `location_name` (case-insensitive), OR
   - shared title token (fallback)
   This restores duplicate-Paris collapse when the user has set `location_name` on at least one of the stays.
3. Where two adjacent segments have *different* hotel titles and *no* `location_name`, keep them separate — the Reshuffle row's inline rename already cascades a single city name to every stay in the merged window, so the user can fix it in one click.

Net effect:
- Popover always opens with the real banded list when ≥ 2 stays exist.
- Duplicates collapse as soon as the user names the city.
- Delete-band UX from the previous change is preserved.

## Files

- `src/lib/segments.ts` — restore title fallback; add post-pass that merges adjacent runs sharing a normalized `location_name`.

## Out of scope

- Changing the empty-state copy or the trash/Apply behavior shipped previously.
