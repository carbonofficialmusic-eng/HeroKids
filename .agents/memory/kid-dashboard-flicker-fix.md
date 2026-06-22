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

## Platform-specific patterns
- `isNativePlatform()` from `@/lib/platform` used to conditionally render collapsible chat bar on iOS vs. centered static bar on web
