## Goal
Make the sticky-footer Gemini Concierge button + popup feel like a first-class editorial AI surface, reusing the `AnimatedAIChat` composer (already wired into the in-workspace `ConciergePanel`) so the experience is consistent across the app.

## Changes — `src/components/GeminiFooter.tsx` only

### 1. Footer trigger button — "Concierge call bell"
Replace the plain bronze `<Button>` with a richer trigger:
- Pill-shaped (`rounded-editorial`), thin foil border (`border-foil`), bronze-gradient fill (`bg-gradient-bronze`) with `shadow-foil` on hover.
- Animated foil sweep along the perimeter on hover (1.2s loop, reuses `@keyframes foil-sweep` already in `index.css`); a slow `pulse` halo behind the icon when the panel is closed so it feels "alive".
- Sparkles icon swaps to a small AI "orb" — bronze radial dot with a soft glow ring (pure CSS, no new deps).
- Label uses Playfair italic small-caps "Concierge" with a hairline divider and an Inter micro-label "Ask Gemini" beneath at `text-[9px]`.
- Active/open state: button collapses to a compact "Close" pill (X icon, muted) so it doubles as the dismiss control.
- Min 44px touch target preserved.

### 2. Popup panel — editorial restage
- Wrap the panel in the same `rounded-hero` + `border-foil` + `shadow-paper` + grain overlay used by Studio/Matrix cards (so it matches the overhaul language).
- Header: Playfair "Gemini Concierge" + Inter eyebrow ("AI Travel Advisor"); the bronze sparkles icon gets the same orb treatment as the trigger.
- Quick-prompt chips restyled with the `AnimatedAIChat` chip aesthetic (`bg-foil-soft`, stagger-in animation).
- Replace the bottom `<textarea>` + Send button block with the existing `<AnimatedAIChat />` component, wiring `value`, `onChange`, `onSubmit={() => send(input)}`, `sending={streaming}`, `quickPrompts` (only when `messages.length === 0` we keep the in-body prompt list; otherwise the composer's own chips can be hidden by passing no `quickPrompts`).
- Streaming state: subtle bronze "typing" shimmer under the latest assistant bubble (3-dot pulse) instead of the plain `Loader2`.
- Entrance: replace the `translate-y-2 opacity-0` open transition with a `scale-in` + `fade-in` combo from the bottom-right origin (transform-origin set on the panel) so it visually "blooms" from the trigger.

### 3. No behavioral changes
- All existing logic (SSE stream parsing, suggestion cards, add-to-itinerary/studio, reset, abort) is preserved verbatim.
- No new dependencies, no edits to `ConciergePanel.tsx`, no schema or store changes.
- Reverts cleanly via History.

## Files touched
- `src/components/GeminiFooter.tsx` — trigger restyle, panel restage, swap composer to `AnimatedAIChat`.

## Out of scope
- The in-workspace `ConciergePanel` (already uses `AnimatedAIChat`).
- Mobile bottom nav, app shell, or routing changes.
