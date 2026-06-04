## Goal
Ensure no one ever sees the login form in Lovable preview / localhost — even if they land directly on `/login`.

## Background
`ProtectedRoute` already calls `ensureDevSession()` for preview hosts, but `/login` is a public route, so visiting it directly (or being redirected to it before the bundle includes auto-auth) shows the form. The published preview build (`preview--ask-tml-hero.lovable.app`) also needs to be republished to pick up the existing auto-auth code.

## Changes

1. **`src/pages/Login.tsx`** — On mount, if `isDevPreviewHost()` is true and there is no session, call `ensureDevSession()` and render a minimal "Loading…" state instead of the form. On success, `navigate(redirectTo, { replace: true })`. The form still renders normally on the production custom domain (`tmlconcierge.com`).

2. **(Optional symmetry) `src/pages/Signup.tsx`** — same treatment so `/signup` doesn't slip through either.

3. **User action** — After the patch lands, click **Publish → Update** so the published preview URL serves the new bundle. (Custom domain is unaffected.)

## Verification
- Visit `/login` in the live editor preview → should flash "Loading…" then land on `/`.
- Visit `/login` on `tmlconcierge.com` → form still shows.
- "Open preview in new tab" from the Lovable header → lands directly on Trips after republish.
