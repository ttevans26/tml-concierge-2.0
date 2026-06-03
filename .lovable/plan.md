# Social Post Ingest → Studio Vault

Add the ability to paste an Instagram or TikTok URL into TML Concierge, extract location + recommended places from the public caption, and stage results in a review tray that creates/uses a Studio folder named after the detected destination.

iOS share-sheet wiring (PWA Web Share Target + Capacitor Share Extension) is deferred; the ingest pipeline is built so that a future share entry point just POSTs to the same endpoint.

## User flow

1. In **Studio**, a new **"Paste Social Link"** button opens a small dialog (URL + optional note).
2. Backend resolves the URL via **oEmbed** (Instagram `/oembed`, TikTok `/oembed`) → returns caption, author, thumbnail.
3. Gemini parses the caption and returns structured JSON: `{ destination, confidence, items: [{ title, category, address?, note }] }`.
4. Results land in a **Pending Social Imports** tray (modeled after Smart Pull Inbox) with:
   - Detected destination + suggested folder (existing match or "Create new: {Destination}").
   - Editable list of extracted items, each with category dropdown (Stay / Dining / Activity / Site) and keep/discard toggle.
   - Source preview (thumbnail + caption + link back).
5. **Commit** creates the folder if needed, runs each kept item through the existing Google Places validation (reuses entity validation flow to populate `google_place_id`, `lat/lng`, `address`, photo) and inserts into `studio_items`.

## Scope

- `studio_social_imports` table (staging) so review state survives reloads and the future share target can drop rows here directly.
- Edge function `ingest-social-post` (URL in → oEmbed fetch → Gemini extract → row in `studio_social_imports` with `status='pending'`).
- Studio UI: paste dialog + tray drawer + commit handler.
- Reuse existing `validate-place` / Google Places lookup for each committed item.
- Toast + notification on completion.

## Out of scope (this batch)

- iOS native share sheet (Capacitor share extension).
- PWA `share_target` manifest wiring.
- Scraping comments, video transcription, or visual analysis of the post.
- YouTube / Pinterest / Threads (same pipeline can extend later).

## Technical details

**Schema** (new migration):
```
studio_social_imports (
  id uuid pk, user_id uuid, source_url text, platform text,  -- 'instagram' | 'tiktok'
  caption text, thumbnail_url text, author text,
  detected_destination text, suggested_folder_id uuid null,
  extracted_items jsonb,         -- array of {title, category, address, note, keep}
  status text default 'pending', -- pending | committed | discarded | failed
  error text null,
  created_at, updated_at
)
```
RLS: user-owned, standard CRUD policies + GRANTs to `authenticated` and `service_role`.

**Edge function `ingest-social-post`** (`verify_jwt` default):
- Validate body `{ url, note? }` with Zod; reject non-IG/TikTok hosts.
- Detect platform from hostname; call oEmbed:
  - IG: `https://graph.facebook.com/v18.0/instagram_oembed?url=...` *(requires app token — fallback to public `https://www.instagram.com/api/v1/oembed/?url=...` which still serves caption for public posts; if both fail, save row with `status='failed'` and surface caption-less preview)*.
  - TikTok: `https://www.tiktok.com/oembed?url=...` (no auth needed).
- Send caption + author to Gemini (`google/gemini-2.5-flash`) with tool schema `extract_travel_post` → `{ destination, items[] }`.
- Insert row, return `import_id`.

**Frontend**:
- `src/components/studio/PasteSocialDialog.tsx` — URL input + submit.
- `src/components/studio/SocialImportsTray.tsx` — list pending imports, expand to edit/keep items, "Create folder & add" CTA.
- Hook into `StudioWorkbench` header next to Bulk Import.
- Realtime subscription on `studio_social_imports` so the tray badge updates when a row finishes processing (sets the stage for share-sheet drops later).

**Future share entry point** (designed for, not built):
- Same `ingest-social-post` endpoint will accept POSTs from the Capacitor share extension and from a PWA `share_target` route at `/share-in`. No backend changes needed when that batch lands — just a thin auth-aware wrapper that calls the function and redirects to the tray.

## Files

New:
- `supabase/functions/ingest-social-post/index.ts`
- `src/components/studio/PasteSocialDialog.tsx`
- `src/components/studio/SocialImportsTray.tsx`
- migration: `studio_social_imports` table + RLS + GRANTs

Edited:
- `src/components/studio/StudioWorkbench.tsx` (add buttons + tray mount)
- `src/integrations/supabase/types.ts` (auto-regen after migration)
- `mem://index.md` + new `mem://features/social-post-ingest`

## Open question

Instagram's public oEmbed endpoint has been progressively locked down; for posts where it returns 401, the import will land with caption empty and we'll fall back to "user pastes/edits caption" inline in the tray. Acceptable for v1?