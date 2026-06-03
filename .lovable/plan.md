## Goal
Make the Edit/Set Location dialog snappier and replace the manual `<input type="date">` with a shadcn Calendar popover that's constrained to the trip window.

## Changes (frontend only — `src/components/workspace/LocationLegDialog.tsx`)

1. **Start Date → Calendar popover**
   - Replace the native date `<Input type="date">` with a `Popover` + `Button` trigger showing the formatted date (`EEE, MMM d` or "Pick a date") and a `CalendarIcon`.
   - `<PopoverContent>` renders `<Calendar mode="single" />` with `pointer-events-auto` (per shadcn datepicker guidance).
   - Constrain selectable days with `disabled={{ before: parseISO(tripStart), after: parseISO(tripEnd) }}`.
   - On select, convert to `yyyy-MM-dd` via `format(d, "yyyy-MM-dd")` and close the popover.
   - Auto-clamp `nights` to the new `maxNights` so picking a later start doesn't leave an invalid Nights value (current bug: Nights stays high then snaps only on Save).

2. **Reduce lag / fix small bugs**
   - Memoize `tripStart` / `tripEnd` parsed Date objects so the Calendar doesn't re-create them every render.
   - Guard `useEffect` reset so it only runs when the dialog *opens* (`open` transitions false→true), preventing the form from being reset mid-edit when parent re-renders push new `leg`/`initialStart` refs. Use a `useRef` "lastOpenedKey" or check `open && !prevOpen`.
   - Move the `endDate` computation guard so it doesn't `parseISO("")` on empty state.
   - Disable Save while `submitting` *and* show a spinner state (already partly there) — also disable the Delete button while submitting.
   - Wrap `handleSelect` / submit in stable callbacks to avoid re-rendering `PlaceAutocomplete` on every keystroke.

3. **Nights field**
   - Keep numeric input but clamp on blur (not on every keystroke) so typing "10" in a 7-night window isn't blocked mid-type. Final clamp still applied at submit.

## Out of scope
No changes to `handleSaveLeg` in MatrixGrid or to segment/reshuffle logic — the underlying save path is fine; perceived lag comes from the dialog re-renders and the native date picker UX.

## Files
- `src/components/workspace/LocationLegDialog.tsx` (edit)
