# Plan

Two unrelated fixes bundled together.

---

## Part A — Studio map broken on `tmlconcierge.com` (mobile)

### What's happening
Your screenshot is from `tmlconcierge.com`, your custom domain. The Studio mobile view shows **"Oops! Something went wrong. This page didn't load Google Maps correctly."**

This is **not a bug in our code**. The Google Maps key Lovable provides by default is **referrer-restricted to `*.lovable.app` and `*.lovableproject.com`**. On any other domain (including `tmlconcierge.com`) Google rejects the request and the map renders the gray "Oops" screen. The same Studio map works fine on the `.lovable.app` preview.

### Fix (requires action from you in Google Cloud Console)
There's no code change that can solve this — the managed key's referrer list is not user-configurable. You need to provide your own Google Maps key for the custom domain. Steps:

1. **Google Cloud project** with billing enabled (required even for free tier).
2. **Enable APIs**: Maps JavaScript API, Places API (New), Geocoding, Routes — anything the app uses today.
3. **Create an API key** in that project.
4. **Set HTTP referrer restrictions** on the key, adding BOTH patterns (root and subdomain are separate):
   - `https://tmlconcierge.com/*`
   - `https://*.tmlconcierge.com/*`
   - (optionally also `https://www.tmlconcierge.com/*`)
5. Once you have the key + referrers configured, I'll open the Google Maps connector and you can paste it in as a **custom** (non-managed) connection. The managed connection stays — they coexist.

Until that's done, the map on the custom domain will keep showing "Oops". The `.lovable.app` preview is unaffected.

I'll wait for you to confirm you have the key in hand before opening the connector dialog.

---

## Part B — Lock to single account (Options #1 + #3)

Goal: never silently land in `dev@tml.local` again, and always see which account is signed in.

### B1. Disable the dev auto-auth shortcut (#1)

**File: `src/lib/devAutoAuth.ts`**
- Make `ensureDevSession()` a no-op that returns `false` immediately.
- Keep `suppressDevAutoAuth`, `clearDevAutoAuthSuppression`, `isDevAutoAuthSuppressed`, `DEV_EMAIL`, `DEV_PASSWORD`, `isDevPreviewHost` exports intact so the existing imports in `Login.tsx`, `Signup.tsx`, `useAuth.tsx`, `ProfileDrawer.tsx`, `ProtectedRoute.tsx` keep compiling. They become harmless.
- Add a top-of-file comment explaining that the shortcut is intentionally disabled to prevent silent account swaps and to avoid writing data to the wrong account.

**File: `src/components/ProtectedRoute.tsx`**
- Remove the `ensureDevSession()` call path so an unauthenticated visit on preview now redirects to `/login` (same behavior as production), instead of silently signing into `dev@tml.local`.

**Result:** On any fresh session — preview, incognito, post-logout, new device — you'll land on `/login` and must explicitly sign in as `thomas26evans@gmail.com`. No more accidental writes to the dev account.

### B2. Always-visible account indicator in the header (#3)

**File: `src/components/AppHeader.tsx`** (or wherever the top bar with the people/bell/profile icons lives — I'll confirm during implementation)
- Add a small **email chip** next to the profile icon showing the current signed-in email (e.g. `thomas26evans@gmail.com`). On mobile, truncate to the username portion (`thomas26evans`) to save space; show full email in a tooltip / on tap.
- Use existing tokens: `text-xs`, `text-muted-foreground`, 0.5px border, 2px radius, Inter — consistent with Quiet Luxury aesthetic.
- Source the email from `useAuth()` (already wired). When no session, render nothing.
- Tapping the chip opens the existing `ProfileDrawer` (same as the profile icon), where "Sign out" already lives.

**Result:** You can glance at the header from any screen and immediately verify which account is active. If it ever says `dev@tml.local`, you know to sign out before doing anything.

### Files touched (Part B)
- `src/lib/devAutoAuth.ts` (gut the auto-auth, keep exports)
- `src/components/ProtectedRoute.tsx` (drop the auto-auth call)
- `src/components/AppHeader.tsx` (add email chip)

### Out of scope
- No database migrations.
- No changes to login/signup flow itself.
- No account merge or data migration — your `thomas26evans@gmail.com` data is already intact.
- No production-vs-preview branching: the shortcut is killed everywhere, which is the safest posture.

### What you'll experience after Part B ships
1. Open the preview → land on `/login` → sign in as `thomas26evans@gmail.com` once.
2. Header always shows your email.
3. If you ever see a different email up there, sign out and back in — no risk of silent data loss.
