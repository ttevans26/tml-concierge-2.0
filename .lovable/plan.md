## Goal
Single dialog for stays in the Matrix Grid. Clicking an empty Stays cell **and** clicking an existing stay pill open the same form, pre-filled appropriately.

## New form (one popup, one schema)

| Field | Notes |
|---|---|
| Property name | Google Places search (lodging) — same autocomplete as today |
| Property type | Segmented control: **Hotel** \| **Airbnb** (default Hotel) |
| Check-in | Date picker, defaults to clicked cell date / existing `date` |
| Check-out | Date picker, defaults to check-in + 1 night / existing `metadata.end_date + 1` |
| Nights | Read-only derived from dates |
| Nightly rate | Number |
| Taxes & fees | Optional flat number |
| **Total cost** | Auto = `rate × nights + taxes/fees`; user can type to override. Small "Reset to calculated" link appears when overridden |
| Confirmation code | Optional text |
| **Cleaning fee** | Airbnb only — flat number, added to total when not overridden |
| **Listing URL** | Airbnb only — text input, stored on `source_url` |

Derived-location chip ("Inside Paris") stays in the edit case.

## Implementation

### 1. New `src/components/workspace/StayDialog.tsx`
- Replaces both the `category === "stays"` branch of `AddItemDialog` and the standalone `EditStayDialog`.
- Props: `{ open, onOpenChange, mode: "create"|"edit", tripId, tripStart, tripEnd, legs, defaultDate?, pill? }`.
- Internal logic:
  - `nights = max(1, diffDays(checkOut, checkIn))`
  - `calculatedTotal = rate*nights + (taxes||0) + (propertyType==="airbnb" ? (cleaningFee||0) : 0)`
  - `total` state seeded from calculated; if user edits, mark `totalOverridden=true`. Toggle "Reset" restores derived.
- Persisted shape on `itinerary_items`:
  - `date` = check-in
  - `cost` = final total (calculated or override)
  - `source_url` = listing URL (Airbnb)
  - `confirmation_code` = code
  - `metadata` =
    ```
    {
      end_date,            // last night inclusive
      check_out,           // exclusive
      property_type: "hotel" | "airbnb",
      nightly_rate,
      taxes_fees,
      cleaning_fee?,       // airbnb only
      total_override?: number | undefined
    }
    ```
- Edit mode: hydrates from `pill.firstItem` on open transition (same `prevOpen` guard pattern as today's `EditStayDialog`); on save converts legacy multi-row pills by deleting trailing per-night rows (carry over existing logic).
- Delete button shown in edit mode only.

### 2. `AddItemDialog.tsx`
- Remove the entire `category === "stays"` branch and related stays-only state (`checkoutDate`, `location`). Keep dining/logistics/activity branches untouched.
- When `category === "stays"`, `MatrixGrid` will no longer route to this dialog (see step 3).

### 3. `MatrixGrid.tsx`
- Replace lazy `AddItemDialog` mount with: if `dialogState.category === "stays"` render `<StayDialog mode="create" ... />`; otherwise render `<AddItemDialog />`.
- Replace lazy `EditStayDialog` usage with the same `StayDialog mode="edit"`.
- `openAdd("stays", date)` path is unchanged; just hits the new dialog.

### 4. Delete `src/components/workspace/EditStayDialog.tsx`
- Logic absorbed into `StayDialog`.

## Out of scope
- No DB schema changes (everything fits in existing `metadata` JSONB + `cost` + `source_url` + `confirmation_code`).
- No changes to Matrix pill rendering, drag/resize, or daily totals (they already read `cost` and `metadata.end_date`).
- No changes to Studio drop-in, Reshuffle, or location legs.

## Verification
1. Click empty Stays cell → new unified dialog opens with that date as check-in, Hotel selected, total auto-calculates as rate × nights.
2. Toggle to Airbnb → Cleaning fee and Listing URL appear; total includes cleaning fee.
3. Type into Total → "Reset to calculated" appears; click to restore.
4. Save → pill appears with correct nights, total cost spreads across days in Daily $ row.
5. Click existing pill → same dialog opens in edit mode with all fields hydrated, including property type from `metadata.property_type` (defaults to Hotel for legacy rows).
6. Delete button only visible in edit mode; removes all `itemIds` on the pill.
