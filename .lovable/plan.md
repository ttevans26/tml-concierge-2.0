## Quick Reshuffle: list-style leg reordering

Dragging a leg pill across many day-columns in the Matrix is awkward. Add a compact "Reshuffle" affordance that opens a vertical, playlist-style list of all location legs so you can drag them up/down (or use ▲/▼ buttons) — night counts stay locked, dates recompute automatically around the new order.

### Where it lives

A small **`Shuffle` icon button** added to the leg-row toolbar in `MatrixGrid.tsx` (next to the existing pan / "Trip starts" controls, above the location pills). Tooltip: *"Reshuffle legs"*.

Clicking opens a `Popover` (anchored under the button, ~360px wide) titled **"Reshuffle legs"** with:
- Subtitle: *"Drag to reorder. Night counts stay; dates shift automatically."*
- A vertical list of leg rows, one per segment, in current order.

### Each row shows

```
≡  London                                ▲ ▼
   Aug 20 → Aug 24 · 4 nights
```

- Grip handle (left) — drag up/down within the list.
- Location name (Playfair, sm).
- Date range + nights count (Inter, xs, muted).
- ▲ / ▼ icon buttons on the right for one-tap moves (disabled at top/bottom).
- "Unassigned days" segments are listed but rendered muted and **non-draggable** (locked in place visually, same behavior as today's EditTripDialog reorder).

A live preview line at the bottom: *"New trip window: Aug 13 → Sep 10"* (unchanged total, just confirms nothing fell off).

Footer: **Cancel** · **Apply reshuffle** (primary). Apply is disabled until the order actually changes.

### Behavior

Reuse the existing engine — no new logic:
- `buildSegments(activeTrip, itineraryItems)` → initial list.
- On Apply: `computeReorderPatches(activeTrip, newOrder, items)` → `bulkUpdateItemDates(patches)` (same flow `handleLegReorderSwap` uses today).
- Toast: *"Legs reshuffled"*.
- Close popover; Matrix re-renders with the new vertical rainbow bands already in place.

### Drag-across-the-grid: keep or remove?

Keep the existing drag-to-swap on the horizontal leg pills (some users will discover it), but the Reshuffle popover becomes the primary, recommended path. No change to the pills' visual treatment.

### Files

- `src/components/workspace/MatrixGrid.tsx`
  - Add `Shuffle` lucide icon import.
  - Add a `Popover` trigger button in the leg toolbar area (near the existing "Trip starts" popover).
  - Render the new `ReshuffleLegsList` inside the popover.
- `src/components/workspace/ReshuffleLegsList.tsx` *(new)*
  - Self-contained list using `@dnd-kit/sortable` (already a dep — `SegmentCard` uses it).
  - Reuses `SegmentCard`-style row markup but trimmed (no category-count chips, adds ▲/▼ buttons).
  - Props: `trip`, `items`, `onApply(patches)`, `onClose()`.

No store, schema, or `segments.ts` changes — purely a new presentation surface over existing helpers.

### Validation

- Open the popover, drag "London" from position 3 → position 1. Apply. Every London-window item moves to the start of the trip; following legs slide back by London's night count; total trip length unchanged.
- ▲/▼ buttons produce the same result as dragging by one slot.
- Cancel discards changes; no DB write.
- Unassigned-day rows can't be dragged but render in place so users see the full picture.
