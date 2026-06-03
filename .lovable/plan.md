
## Problem

The Matrix grid's wheel handler (`src/components/workspace/MatrixGrid.tsx`, `useEffect` around L176–230) was designed for a discrete mouse wheel: it captures vertical `deltaY`, accumulates it into a target `scrollLeft`, and eases toward that target with `requestAnimationFrame`. On a trackpad this produces three compounding issues:

1. **Double inertia / rubber-band.** Trackpads emit dozens of small wheel events with their own native momentum curve. Our RAF easing layers a second decay on top, so the grid keeps gliding after the fingers lift and overshoots the user's gesture.
2. **Vertical scroll hijack.** Any two-finger swipe with even a slight vertical component (`|deltaY| > |deltaX|`) gets converted to horizontal pan, so the page no longer scrolls vertically the way the user expects when the cursor is over the matrix.
3. **Native horizontal swipe fights easing.** When the user actually swipes horizontally (`|deltaX| > |deltaY|`), we early-return — but the easing loop from the *previous* vertical delta is still running, so the native horizontal scroll and the eased horizontal scroll collide and jitter.

## Fix

Differentiate trackpad from mouse wheel and only apply the wheel→pan conversion + easing for a real mouse wheel. Trackpads get fully native scroll behavior (horizontal two-finger swipe pans the grid; vertical swipe scrolls the page) with zero JS interference.

**Detection heuristic** (standard, used by Figma/Linear/etc.):

- A wheel event is treated as a *mouse wheel* when `deltaMode === 1` (line mode), OR when `Math.abs(deltaY) >= 50` AND `deltaY % 1 === 0` AND `deltaX === 0`. Discrete, integer, vertical-only ≈ scroll wheel notch.
- Anything else (small fractional deltas, any deltaX, or simultaneous x/y) is treated as a *trackpad/precision* input and we **do not** preventDefault, do not start RAF, do not touch `scrollLeft`. The browser handles it natively.

**Behavior changes**

- Trackpad two-finger horizontal swipe → native horizontal scroll of the matrix (already works because container is `overflow-auto`). No easing layered on top, no jitter.
- Trackpad two-finger vertical swipe → page scrolls vertically as normal. Matrix no longer eats the gesture.
- Mouse scroll wheel over the matrix → existing behavior preserved: vertical wheel notches convert to smooth horizontal pan with the RAF easing, only when the matrix can still pan horizontally; otherwise the page scrolls vertically.
- Cancel any in-flight RAF the moment a trackpad event arrives so a lingering mouse-wheel ease doesn't fight a new trackpad gesture.

**Drag-pan (mousedown/mousemove) and arrow-button scrolls are unchanged.**

## Files to edit

- `src/components/workspace/MatrixGrid.tsx` — replace the `handleWheel` body inside the existing `useEffect` (L176–230). No new imports, no signature changes, no other component touched.

## Out of scope

- No changes to the drag-pan handlers, arrow buttons, or scroll-edge state.
- No changes to keyboard shortcuts.
- No touch / pointer event handling changes (mobile already uses native scroll).

## Validation

- On a MacBook trackpad: two-finger horizontal swipe glides the matrix left/right with native rubber-banding, no judder. Two-finger vertical swipe scrolls the page; the matrix doesn't intercept. Diagonal swipes feel natural (both axes move independently).
- On a Magic Mouse / external wheel mouse: scrolling the wheel up/down over the matrix still pans horizontally with the existing smooth easing.
- On Windows precision touchpad: same as MacBook trackpad.
- Arrow buttons and click-drag still pan as before.
