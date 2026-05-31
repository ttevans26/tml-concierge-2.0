## Profile Drawer Restructure

Reorganize the right-hand `ProfileDrawer` to lead with a personal identity block and add a new "Profile & Security" section above existing nav.

### 1. Identity Header (top of drawer)
Replace the current minimal `SheetHeader` (just "Profile" + email) with a richer identity card:
- **Avatar placeholder** — 56px circular `Avatar` (shadcn) on the left. Falls back to user's initials in Playfair on a muted Bronze Beige tint. No upload wiring yet (placeholder only, non-interactive — clicking could be wired later).
- **Full name** — Playfair, 16px semibold. Pulled from `profiles.full_name` (loaded alongside existing `preferences` fetch in `loadPrefs`). Fallback: derive from email local-part if not set.
- **Email** — Inter, 11px muted, under the name.

Layout: horizontal flex, avatar + stacked text. Replaces the current `SheetTitle`/`SheetDescription` block.

### 2. New "Profile & Security" Section
Insert directly below the identity header, above the existing nav list (Travel Preferences, Concierge Sessions, Travel Network).

Implement as a new collapsible subheader that toggles open/closed (matches the existing `Travel Preferences` two-view pattern — pushes a new `view: "security"` into the existing view state machine, keeping the back-chevron pattern).

Subheader row in menu view:
- Icon: `ShieldCheck` (lucide)
- Label: "Profile & Security"
- Chevron right

Inside the `security` sub-view (mirrors the existing `preferences` sub-view styling):
- **Personal Details**
  - Full Name (text input, saves to `profiles.full_name`)
  - Display email (read-only, from `user.email`)
- **Security**
  - "Change Password" button → triggers Supabase `resetPasswordForEmail` to user's email and toasts confirmation (matches existing forgot-password flow in `src/pages/ForgotPassword.tsx`).
  - "Sign out of all devices" ghost button → `supabase.auth.signOut({ scope: 'global' })`.

Save button at bottom (same pattern as Travel Preferences save).

### 3. Order After Changes
```
[Avatar | Full Name / Email]
─────────────────────────────
Profile & Security      ›
Travel Preferences      ›
Concierge Sessions     [n]
Travel Network
─────────────────────────────
Privacy (Public Profile toggle)
─────────────────────────────
Sign Out
```

### Files Touched
- `src/components/ProfileDrawer.tsx` — identity header, new view state `"security"`, new sub-view, reorder nav. Extend `loadPrefs` to also select/store `full_name` from `profiles`.

### Out of Scope
- Avatar image upload / storage bucket wiring (placeholder only).
- 2FA, session management beyond global sign-out.
- Schema changes — `profiles.full_name` already exists in the schema; if it doesn't on inspection during build, I'll add a migration then.
