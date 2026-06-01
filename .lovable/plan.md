## Goal

Transform the placeholder `GeminiFooter` bubble into a working chat that streams responses from Lovable AI (Gemini), grounded in the user's active trip context (destination, dates, itinerary, preferences). Single-session for MVP — no persistence.

## Scope

**In:**
- New streaming edge function `concierge-chat` (Lovable AI Gateway, Gemini 2.5 Flash)
- Expanded chat UI in `GeminiFooter.tsx` (wider panel, message thread, input, streaming render, markdown)
- Trip + profile context injected as system prompt
- Quick-prompt chips (e.g. "Suggest a dinner near my hotel", "What am I missing?")
- 429 / 402 error toasts

**Out (future phases):**
- Persisting conversations to DB
- Tool calling to actually create itinerary items from chat (suggest only, with copy/add buttons later)
- Multi-trip / cross-session memory
- Voice input

## Architecture

```text
GeminiFooter (client)
  └─ POST /functions/v1/concierge-chat  (SSE stream)
       └─ Lovable AI Gateway → google/gemini-3-flash-preview
            ├─ system: TML voice + active trip context + user prefs
            └─ messages: full thread history (client-sent)
```

Context built client-side from `useTripStore`:
- `activeTrip` (name, destination, dates, budgets)
- `itineraryItems` (compact summary: category, title, date)
- `profile.preferences` (quality bars, loyalty, amenities)
- `activeAnchor` (if set — anchor stay for proximity questions)

## Files

**New**
- `supabase/functions/concierge-chat/index.ts` — SSE proxy to Lovable AI, CORS, 429/402 handling, no auth required (public, stateless)

**Modified**
- `src/components/GeminiFooter.tsx` — replace placeholder with full chat: message list, streaming render, input, send/clear, quick prompts. Add `react-markdown` for assistant messages.
- `package.json` — add `react-markdown` if not present

## UI Behavior

- Bubble expands from ~288px → ~380px wide × ~520px tall when active
- Empty state: 3–4 quick-prompt chips tailored to active trip (or generic if no trip)
- Streaming tokens render live into the last assistant bubble
- Cream/Onyx/Bronze palette, 0.5px borders, 2px radii (per design system)
- Mobile: full-width sheet from bottom

## System Prompt (sketch)

> You are the TML Concierge — a discreet, points-savvy luxury travel advisor. Voice: editorial, concise, never sycophantic. Always cite *why* (proximity, points multiplier, fit with stated preferences). When the traveler has an active trip, ground answers in their itinerary, budget, and anchor stay. Never invent confirmation codes or prices.
>
> [ACTIVE TRIP] {name} · {destination} · {dates} · budget {…}
> [ANCHOR] {stay name or "none"}
> [ITINERARY] {compact list}
> [PREFERENCES] {prefs block}

## Open question

Should the concierge be able to **suggest items the user can one-click add to their itinerary** in this first pass (via tool-calling, similar to `get-concierge-suggestions`), or keep MVP as chat-only with copy/paste? Recommendation: chat-only now; add "Add to itinerary" buttons in a follow-up.
