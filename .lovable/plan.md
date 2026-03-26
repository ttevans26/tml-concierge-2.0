

## Phase 1: Foundation & Design System

### What will be done

1. **Save `project_plan.md`** at project root with the approved plan text.

2. **Install dependencies**:
   - `zustand` (state management)
   - `@supabase/supabase-js` (for Phase 2, install now)

3. **Load fonts** in `index.html`:
   - Google Fonts: Playfair Display (600, 700) + Inter (400, 500, 600)

4. **Update design tokens** in `src/index.css`:
   - Background: Soft Cream `#FDFCF8` → HSL(43, 71%, 98%)
   - Foreground/Primary: Onyx `#1A1A1A` → HSL(0, 0%, 10%)
   - Accent: Bronze Beige `#9B7E4B` → HSL(36, 45%, 42%)
   - Border: 0.5px thin lines (subtle warm gray)
   - Radius: `2px` sharp corners

5. **Update `tailwind.config.ts`**:
   - Add `fontFamily`: `playfair` (Playfair Display) and `inter` (Inter)
   - Set `--radius: 2px`
   - Add bronze accent color tokens
   - Add `border-thin` utility for 0.5px borders

6. **Update `index.html`**: Set title to "TML Concierge", update meta tags.

7. **Clean up**: Remove `src/App.css` (Vite boilerplate), update `src/pages/Index.tsx` with a minimal branded landing placeholder confirming the design system is active (showing typography, colors, spacing).

### Files touched
- `project_plan.md` (create)
- `package.json` (dependencies)
- `index.html` (fonts, meta)
- `src/index.css` (design tokens)
- `tailwind.config.ts` (theme extensions)
- `src/App.css` (delete)
- `src/pages/Index.tsx` (branded placeholder)

