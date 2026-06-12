## Plan: Swap iOS / PWA icon to uploaded TML globe artwork

The uploaded image has a light off-white surrounding margin already, which works well for Apple touch icons (iOS adds its own mask) and is fine for the standard PWA icons. For the maskable variant, iOS/Android mask aggressively so we'll generate a centered version with extra safe-zone padding on a cream background.

### Steps

1. Crop the uploaded image to a square (1024×1024), trimming the outer whitespace evenly so the rounded-square artwork fills the frame.
2. Regenerate these files from that square master:
   - `public/icon-512.png` — 512×512
   - `public/icon-192.png` — 192×192
   - `public/apple-touch-icon.png` — 180×180, opaque cream background (iOS dislikes transparency)
   - `public/icon-512-maskable.png` — 512×512, artwork scaled to ~80% inside cream `#FDFCF8` background for safe zone
3. Leave `public/manifest.webmanifest` and `index.html` head tags unchanged — paths already match.
4. Note to user: iOS caches home-screen icons aggressively. After republishing, remove the old "Add to Home Screen" tile and re-add it to see the new icon.

### Technical notes

- Use ImageMagick (`nix run nixpkgs#imagemagick`) for crop/resize.
- Keep the cream background `#FDFCF8` consistent with existing brand tokens.
- No code changes — only binary assets in `public/`.
