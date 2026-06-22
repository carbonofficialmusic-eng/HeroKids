---
name: Kid Dashboard Safari/WebKit Flicker Fix
description: Root causes of scroll flickering on kid-dashboard and what actually fixed it
---

# Kid Dashboard Flicker — What Worked

## Root Causes (confirmed by systematic elimination)

1. **`backdrop-filter`/`backdrop-blur`** on cards and header → remove entirely from scrollable content
2. **`motion.div` entrance animations** (Framer Motion `initial/animate`) in scrollable area → replace with plain `<div>`
3. **`animate-pulse`** (CSS infinite opacity loop) on Flame/Star icons in header → remove wrapper, show icons static
4. **`filter: grayscale()`** inline style per task emoji → replace with `opacity` class (no GPU layer forced)
5. **`transition-all`** on card elements → replace with `transition-colors` only
6. **`hover:-translate-y-0.5`** on card wrapper divs → remove (creates compositor layer on every hover; with many cards = flicker)
7. **`motion.img`** logo spring animation on mount → replace with plain `<img>` (even one-time animations promote layers)

**Why:** Each of these forces the browser to promote elements to GPU compositor layers. With many layers active during scroll, WebKit/Chrome can't composite fast enough → visible flicker.

## What Did NOT cause it
- `backdrop-blur` on the parent dashboard header (it has `backdrop-blur-md` and never flickered)
- `box-shadow` (static, not transitioning)
- 30-second notification polling (causes React re-renders but not visual flicker)

## Safe to Keep
- `active:scale-[0.96/0.97/0.98]` on card wrappers (only activates on press, not hover — no persistent layer)
- `transition-transform` for chevron rotations (small element, not expensive)
- `translateZ(0)` + `backface-visibility: hidden` on the fixed `<header>` element only (NOT on `#root` scroll container)
- `drop-shadow-sm` on 3D nav icons

## IMPORTANT: Never add `transform: translateZ(0)` to `#root`
Adding GPU transform to the scroll container (`#root`) breaks `position: fixed` children — they become fixed relative to `#root` instead of the viewport, so the header scrolls with the page.

**Why:** CSS transforms create a new containing block for fixed-position descendants.

## Round 2: Remaining vertical-only flicker (Safari web)

**Cause:** `position: fixed` element with `-translate-x-1/2` CSS transform (used for centering).
Safari recalculates transform positions relative to the viewport on every scroll frame → vertical jitter.

**Diagnostic clue:** Parent dashboard had 0 flicker; kid dashboard had vertical-only flicker.
Difference: kid dashboard had a `fixed bottom-0 left-1/2 -translate-x-1/2` web chat bar — parent dashboard had no fixed bottom element on web.

**Fix:**
- Replace `left-1/2 -translate-x-1/2` centering with `left-0 right-0 flex justify-center`
- Add `transform: translateZ(0)` + `backfaceVisibility: hidden` to promote to own GPU layer
- Add `pointer-events-none` on the full-width wrapper + `pointer-events-auto` on inner card so clicks through the invisible sides still work
- Downgrade `shadow-2xl` → `shadow-lg` (cheaper to composite)

**Rule:** Never use CSS transforms (`translate`, `translateX`, `scale` etc.) for layout/positioning of `position: fixed` elements. Use flexbox/grid centering instead. Always add `translateZ(0)` to fixed overlays to keep them on a dedicated compositor layer.

## Platform-specific patterns
- `isNativePlatform()` from `@/lib/platform` used to conditionally render collapsible chat bar on iOS vs. centered static bar on web
- iOS native chat bar: `fixed bottom-0 right-0` (no centering transform needed)
- Web chat bar: `fixed bottom-0 left-0 right-0 flex justify-center` + `translateZ(0)`
