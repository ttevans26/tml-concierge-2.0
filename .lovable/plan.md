# Intelligence Layer — Pitch-Ready Enhancements

Focus: make the trip workspace feel **intelligent and indispensable**. Three tightly-scoped features that build on infrastructure already in the project (`concierge-chat`, `smart-pull`, Matrix Grid, anchor logic).

---

## 1. Docked Concierge Chat (workspace right-panel)

Promote the floating `GeminiFooter` into a first-class panel inside `/trip/:id`.

- **Location**: Right-panel tab on the workspace, alongside the existing Logistics Sidebar. Toggle between "Logistics" and "Concierge".
- **Context-aware prompt**: Every message auto-injects the active trip's destinations, dates, active anchor (Stay), and currently-selected day column from the Matrix. So "what's near here for dinner Tuesday?" just works.
- **Suggested-action chips**: After each AI response, parse for actionable items (restaurant, activity, stay) and render "+ Add to Day 3" chips that push the item into the Matrix as a draft Smart Card.
- **Conversation persistence**: Store the thread on the trip so the user can resume. New `concierge_messages` table (trip_id, role, content, created_at, suggested_items jsonb).
- **Memory of preferences**: Concierge reads `profiles.preferences` (quality tier, dietary, vibes) so suggestions match the user's profile without re-asking.

## 2. Smart Pull Inbox

Upgrade the existing `smart-pull` edge function into a visible, repeatable workflow rather than a one-off paste box.

- **Inbox UI** (header dropdown or trip-workspace toolbar button "📥 Smart Pull"):
  - Paste-zone (email body, URL, screenshot OCR later) → "Parse"
  - Streaming preview of parsed entity: title, dates, cost, confirmation code, category badge
  - Side-by-side **diff against existing itinerary** ("This overlaps with: Hotel Splendido, Sept 4")
  - Single click "Add to trip" / "Replace existing" / "Discard"
- **Batch mode**: paste multiple confirmations separated by `---`, parse all, review as a stack.
- **History log**: persisted `smart_pull_events` so users see what's been auto-imported and can undo within 24h.
- **Enrichment chain**: after parse, automatically call `aviationstack-lookup` for flight numbers and Google Places for venue names to fill missing metadata.

## 3. Matrix Gap Detection (the "auto-detect" magic)

Real-time analysis that surfaces planning holes directly in the Matrix Grid.

- **Detection rules** (computed in Zustand selector, no backend):
  - No Stay on a night → red dotted cell with "Add accommodation"
  - No Dining slot on a day → soft amber chip "No dinner planned"
  - Long unscheduled gap (>4h) between known items → "Free afternoon — explore?"
  - Travel-day mismatch: stay city changes but no Logistics item → "Missing transit"
- **Visual treatment**: subtle pulse on empty cells; aggregate count badge on the day header ("3 gaps").
- **One-tap fix**: clicking a gap opens a mini-concierge prompt pre-loaded with context ("Suggest 3 dinners near Hôtel du Cap on Sept 5, under €120pp"). User picks → added as draft Smart Card.
- **Trip-level summary**: top of workspace shows "92% planned · 3 gaps" with a "Resolve all with concierge" button that walks the user through each gap as a stack.

---

## Technical sketch

```text
src/
├── components/workspace/
│   ├── ConciergePanel.tsx         (docked chat w/ context injection + action chips)
│   ├── SmartPullInbox.tsx         (paste → preview → diff → commit flow)
│   ├── GapBadge.tsx               (in MatrixGrid day headers + empty cells)
│   └── TripHealthBar.tsx          ("92% planned" summary + resolve-all)
├── lib/
│   ├── gapDetection.ts            (pure selector over itinerary_items)
│   └── conciergeContext.ts        (builds context blob for AI prompt)
└── stores/useTripStore.ts         (add: gaps selector, draftFromAI action)

supabase/
├── functions/concierge-chat/      (extend: accept trip context, return suggested_items[])
├── functions/smart-pull/          (extend: enrichment chain, batch mode)
└── migrations/                    (concierge_messages, smart_pull_events tables)
```

**Tables (RLS scoped to auth.uid()):**
- `concierge_messages` — trip_id, role, content, suggested_items jsonb, created_at
- `smart_pull_events` — trip_id, source_text, parsed_payload jsonb, applied bool, created_at

**Existing infra reused:** `concierge-chat`, `smart-pull`, `aviationstack-lookup`, Google Places, `useTripStore`, active anchor logic, loyalty badge system.

---

## Build order

1. **Gap Detection** — fastest visible win, pure frontend, no backend changes. Anchors the "intelligent" feel.
2. **Docked Concierge** — moves existing floating widget into the workspace, adds context injection + action chips. Demo centerpiece.
3. **Smart Pull Inbox** — extends existing edge function with proper UI, diff, batch. Hero "wow" moment when paste-an-email-and-watch-it-fill-the-grid.

Each is independently demoable, so we can ship in order and you'll have something better to show after each step.
