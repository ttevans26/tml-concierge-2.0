## Problem
In `MatrixGrid.tsx` `handleSaveLeg`, when a user increases Nights for an existing location leg, the new end date overlaps the *next* leg. The current code blocks the save with a hard `toast.error("Overlaps another location leg — adjust dates.")` and returns early — so Nights never updates.

## Fix (frontend only — `src/components/workspace/MatrixGrid.tsx`)

1. **Remove the hard overlap block.** Replace the early-return with an informational `toast.warning` (or `toast` with a warning icon) that says e.g. `"Overlaps {OtherCity} — review your plan."` and then proceed with the save. No blocking.
2. **Keep the conflict detection,** but only to surface a *non-blocking* notice. Still compute `conflicts` so we can name the overlapping leg in the toast.
3. **Gaps:** Detection of *gaps* between legs already lives in the Reshuffle / segments layer; no new logic required here. The dialog change is purely about un-blocking.

## Out of scope
- Reshuffle / segment merging logic (untouched).
- LocationLegDialog UI (already updated to calendar picker).
- Any business-rule changes to Stays category (overnight stays still keep their own validation).

## Files
- `src/components/workspace/MatrixGrid.tsx` — soften `handleSaveLeg` overlap guard from blocking error to non-blocking warning toast.
