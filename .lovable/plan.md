## Concierge AI Depth — Roadmap

Today's state is solid: both surfaces (workspace `ConciergePanel`, floating `GeminiFooter`) share the `concierge-chat` edge function, persist conversations, parse a `suggestions` block into "Add to Itinerary / Studio" chips, and four tools exist (`create_itinerary_item`, `search_studio_items`, `suggest_anchor`, `get_trip_summary`).

Gaps that hold it back from feeling like a real travel partner:
- Workspace panel uses non-streaming `invoke` — replies appear all at once after a long wait, while the footer streams.
- Context fed to the model is thin: no active anchor stay, no "currently focused day", no budget remaining, no loyalty card list.
- Only 4 tools — the model can add items but can't fix routes, find gaps, optimize loyalty earn, or rebalance budget.
- No quick-prompt chips; the user has to think of every prompt themselves.
- Tool-call execution shows up only after completion — no live "calling tool…" affordance.

---

## Phase 1 — Streaming + Richer Context (foundation)

1. **Stream the workspace ConciergePanel** the same way `GeminiFooter` does (SSE, token-by-token, abortable). Share a single `streamConcierge()` helper between both surfaces so we stop maintaining two transports.
2. **Expand the system context block** sent to the model on every turn:
   - Active trip name, date range, days elapsed/remaining
   - Active anchor stay (geo + dates) when one is set
   - Budget snapshot: total, spent, remaining, target nightly
   - User's active loyalty cards + memberships from `profiles`
   - Currently focused day (if user scrolled to a day in the Matrix)
3. **Tool-call live status pills** — render an inline "Calling `create_itinerary_item`…" chip the moment a `tool_call` arrives, replace with the result when it completes.

## Phase 2 — New Tools (planner muscle)

Add four tools to `concierge-chat`, each with a small focused schema:

1. `find_gaps` — returns days with no plans and dining/activity holes (uses existing `gapDetection.ts`).
2. `optimize_loyalty` — given a category + location, returns the best earning card from the user's wallet with multiplier and rationale.
3. `optimize_route` — for a given day, returns a re-ordered sequence of items by proximity (uses existing `distance.ts` haversine).
4. `rebalance_budget` — surfaces over/under categories vs. target nightly budget, suggests trims or splurge headroom.

Each tool result feeds back into the model so it can compose a natural-language reply plus a `suggestions` block when appropriate.

## Phase 3 — Quick-Action Prompts + Polish

1. **Prompt chips** above the input in both surfaces, generated from current context:
   - "What's missing on {focused day}?"
   - "Best card for my next stay"
   - "Optimize my route today"
   - "Where's my budget heaviest?"
   Tapping a chip submits the prompt.
2. **Streaming abort** — visible "Stop" button while a response is in flight (already half-wired in footer; standardize).
3. **Empty-state hero** — when a conversation is new, show 3 context-aware starter prompts instead of a blank panel.

---

## Technical notes

- All work stays inside `supabase/functions/concierge-chat/index.ts` (tools + system context) and the two React surfaces. No schema changes — `concierge_conversations` / `concierge_messages` already support tool_calls JSONB.
- New tools reuse existing client-side helpers (`gapDetection.ts`, `distance.ts`, loyalty match from `useTripStore`); the edge function re-implements the small calculations server-side using data it already loads (itinerary items + profile).
- Streaming helper lives at `src/lib/conciergeStream.ts` so `ConciergePanel` and `GeminiFooter` share one implementation.
- Default model stays `google/gemini-3-flash-preview` for latency; bump to `google/gemini-2.5-pro` only for `optimize_route` if quality calls for it.
- No new secrets, no new tables, no new connectors.

---

## Out of scope (deferred)

- Multimodal image input (paste menu / boarding pass photo) — separate phase.
- "@" mention autocomplete for itinerary/studio items — separate phase.
- Voice input — separate phase.
- Production-readiness items (real auth, Sentry/PostHog DSNs, E2E tests) — separate roadmap thread.

---

## Suggested implementation order

```text
Phase 1  →  immediate UX lift (streaming parity + better answers from richer context)
Phase 2  →  unlocks the "do something for me" use cases
Phase 3  →  discoverability — users learn what concierge can do
```

I'll start with Phase 1 once you approve.