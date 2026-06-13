# TML Concierge

A points-native digital travel studio. Web app built on React + Vite +
Supabase, with an iOS shell via Capacitor.

## Run on iPhone (Capacitor / Xcode)

Requires macOS with Xcode 15+.

```bash
# 1. Pull latest from GitHub
git pull

# 2. Install deps and build the web bundle
npm install
npm run build

# 3. First time only — add the iOS platform
npx cap add ios

# 4. Sync web build + native plugins into ios/
npx cap sync ios

# 5. Open in Xcode, then Run on simulator or your device
npx cap open ios
```

Use `CAP_LIVE_RELOAD=1 npx cap run ios` to point the iOS shell at the
Lovable preview URL instead of the bundled `dist/` (faster iteration; not
for App Store builds).

After any web change, re-run `npm run build && npx cap sync ios`.

## Install as a PWA (no Xcode)

Open the published URL in Safari on iPhone → Share → **Add to Home
Screen**. The manifest, icons, and splash configuration are already wired
(`public/manifest.webmanifest`, `public/icon-*.png`, `public/apple-touch-icon.png`).
If you change the icon, iOS caches the previous tile aggressively —
delete the home-screen icon and re-add it to see the new artwork.
