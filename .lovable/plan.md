

## Smart Pull: Email-Based Travel Extraction

### What This Builds

A "Smart Pull" feature allowing users to paste email confirmation text, have AI extract structured travel data, review items in a dashed-border tray with Accept/Dismiss controls, and optionally enrich flights with Aviationstack gate/terminal data. Confirmation codes render as clickable Google Search deep links for instant verification.

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/smart-pull/index.ts` | Create — Gemini-powered email parser |
| `src/components/workspace/SmartPullTray.tsx` | Create — Review tray with Accept/Dismiss |
| `src/components/workspace/MatrixGrid.tsx` | Modify — Add Smart Pull button + dialog + tray |

### Step 1: Edge Function — `smart-pull`

- Accept `{ email_text: string }`
- Use Lovable AI Gateway with `google/gemini-3-flash-preview`
- System prompt instructs extraction of: title, category (stays/logistics/dining/activity), date, start_time, end_time, description, confirmation_code, flight_number, departure_airport, arrival_airport, estimated_cost
- Use tool calling (structured output) to guarantee JSON schema compliance
- Return `{ items: ExtractedItem[] }`
- Handle 429/402 rate limit errors

### Step 2: Smart Pull Dialog in MatrixGrid

- Add a `Mail` icon button next to Trip Settings in the header
- Opens a Dialog with a `<Textarea>` for pasting email text and a "Extract" submit button (min-h 44px)
- On submit: call `supabase.functions.invoke('smart-pull')` with the text
- Loading state: "Analyzing confirmation..." 
- On success: close dialog, populate `pendingItems` state array
- On error: toast with specific error message

### Step 3: SmartPullTray Component

- Renders above the matrix grid when `pendingItems.length > 0`
- Each card has:
  - Dashed border (`border-dashed border-border`)
  - Title, category badge, date, times, cost
  - **Confirmation code deep link**: if `confirmation_code` exists, render as `<a href="https://www.google.com/search?q={code}" target="_blank">` styled as a clickable monospace badge
  - **Accept** button: calls `useTripStore.createItineraryItem()` with `approval_status: 'draft'`, maps extracted fields to itinerary_items columns, stores flight metadata in `api_metadata` JSONB
  - **Dismiss** button: removes from pending list
- All interactive elements ≥ 44px touch targets

### Step 4: Background Aviationstack Enrichment

- On Accept, if item has `flight_number` in extracted metadata:
  - Fire non-blocking `supabase.functions.invoke('aviationstack-lookup')` 
  - On success: call `updateItineraryItem()` to merge gate/terminal into `api_metadata`
  - On failure: toast "Gate info unavailable" — do NOT remove or alter the accepted item

### Technical Details

- **Model**: `google/gemini-3-flash-preview` via Lovable AI Gateway
- **Auth**: Uses `LOVABLE_API_KEY` (already configured)
- **No DB migration needed** — uses existing `itinerary_items` table and JSONB columns (`metadata`, `api_metadata`)
- **State**: `pendingItems` managed as local React state in MatrixGrid, passed to SmartPullTray as props
- **Deep link format**: `https://www.google.com/search?q=${encodeURIComponent(confirmationCode)}`

