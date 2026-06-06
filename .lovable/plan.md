## Goal
Ship Phase 2 (new tools) and Phase 3 (UX polish) for the Gemini Concierge, building on the streaming + context foundation already in place. Every tool **proposes** — never mutates — so users keep full control via existing flows.

## Phase 2 — New Tools (7 total)

All tools live in `supabase/functions/concierge-chat/index.ts`. Each returns a structured `proposal` payload that the client renders as interactive **suggestion cards** in the chat stream. User clicks "Apply" / "Add to matrix" / "Use this card" to commit; nothing is auto-written.

### Original four
1. **`find_gaps`** — Walks `itinerary_items` for the active trip. Returns days with no items, days missing dinner (no Dining 18:00–22:00), and unfilled accommodation nights. Output: `{ gaps: [{ date, type, suggestion }] }`. Server-side, deterministic.
2. **`optimize_loyalty`** — Given an item or category + cost, scans the user's `loyalty_programs` + credit cards in profile and returns top earning card with multiplier rationale. Output: `{ recommended: { cardName, multiplier, estPoints, why } }`.
3. **`optimize_route`** *(uses `google/gemini-3.1-pro-preview` for the reasoning pass)* — Reads a focused day's items with `google_place_id` / coordinates, runs haversine TSP-nearest-neighbor, returns a re-ordered sequence with estimated transit minutes between stops. Output: `{ proposedOrder: [{ itemId, startSuggestion, transitFromPrev }] }`. **Does not write** — user gets "Apply this order" button.
4. **`rebalance_budget`** — Compares per-category spend vs. trip target nightly (and any per-category caps in profile). Returns categories over/under and which specific items to consider downgrading. Output: `{ summary, overBy, suggestions: [{ itemId, reason, action }] }`.

### Extra three (your picks)
5. **`find_dining_near_anchor`** — Active anchor stay → query Studio dining items + Google Places (existing client API) within radius; sort by distance, return top 5 with photos already-cached. Output: `{ candidates: [{ name, distanceKm, rating, placeId, studioItemId? }] }`. Surfaces as draggable cards.
6. **`summarize_day`** *(pro model)* — Builds a morning/afternoon/evening narrative for the focused day from its items + anchor. Output: streamed markdown, no proposal — pure read.
7. **`suggest_logistics`** *(pro model)* — Detects transitions between location legs without a transport item between them. Returns proposed flight/train/drive options with rough duration + cost band. Output: `{ gaps: [{ fromLeg, toLeg, options: [...] }] }`. Each option becomes an "Add to logistics" card.

### Tool-call rendering (client)
- Add a `ProposalCard` component family under `src/components/workspace/concierge/proposals/` — one variant per tool (`GapsList`, `LoyaltyPick`, `RouteOrder`, `BudgetRebalance`, `DiningCandidates`, `LogisticsOptions`). `summarize_day` renders inline markdown.
- The existing `tool_call_result` SSE event already carries a JSON payload; extend `ConciergePanel` + `GeminiFooter` rendering to switch on `tool_name` and mount the matching proposal card.
- Apply buttons call existing tripStore actions (`addItineraryItem`, `moveItineraryItem`, `bulkUpdateItemDates`) so undo/redo "just works."

## Phase 3 — UX Polish

### Quick-action chips
- New `<QuickPromptChips />` rendered above the input on both surfaces.
- Initial set (your picks + 2 natural additions):
  - "Find gaps in my itinerary" → `find_gaps`
  - "Re-order today by proximity" → `optimize_route` (uses focused day)
  - "Summarize this day" → `summarize_day`
  - "Dinner near my hotel" → `find_dining_near_anchor`
- Chip → injects prompt text + sends. Chips hide once conversation has ≥1 message; reappear via small "Suggestions" pill if user clears.

### Empty-state hero
- When no conversation: hero block with Playfair "Your concierge" + 3 starter prompts as larger cards (Find gaps / Re-order today / Dinner near hotel).

### Streaming controls
- Add **Stop generating** button (uses existing AbortController in `conciergeStream.ts`) shown while a stream is active.
- "Retry" appears when a stream errors mid-flight.

### Misc polish
- Tool-call pill animation: subtle accent dot pulse while running.
- Persist conversation scroll position when switching workspace tabs.

## Technical Notes
- Files: `supabase/functions/concierge-chat/index.ts` (tools 1–7 + system prompt update), `src/components/workspace/ConciergePanel.tsx`, `src/components/GeminiFooter.tsx`, new `src/components/workspace/concierge/proposals/*`, new `src/components/workspace/concierge/QuickPromptChips.tsx`, new `src/components/workspace/concierge/EmptyStateHero.tsx`.
- No DB schema changes. `concierge_messages.tool_calls` JSONB already stores tool inputs/outputs for replay.
- Model routing inside the edge function: default `google/gemini-3-flash-preview`; route `optimize_route`, `summarize_day`, `suggest_logistics` calls to `google/gemini-3.1-pro-preview` with low reasoning effort.
- Reuse `src/lib/distance.ts` (haversine) and `src/lib/gapDetection.ts` for tool 1 & 3 logic; tools call into the function's server-side equivalents (ported small) so they don't depend on browser state.
- `find_dining_near_anchor` runs Google Places via existing edge proxy if available, else returns Studio-only candidates.
- Estimated cost/latency: flash tools ~1–2s, pro tools ~3–5s. Acceptable for proposal flows.

## Out of scope
- Auto-mutations (explicitly rejected — propose-only).
- Packing list drafting.
- Voice input, image input, @mention autocomplete.
- New tables, secrets, or connectors.

## Build order
1. Edge function: add 7 tools + model routing + structured `proposal` payloads. Smoke-test each via `curl_edge_functions`.
2. Proposal card components + dispatcher in chat stream renderer.
3. Quick chips + empty-state hero + stop button.
4. End-to-end QA: gaps detection on a sparse day, route reorder on a full day, loyalty pick on a hotel, dining suggestions with an active anchor.
