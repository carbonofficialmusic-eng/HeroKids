---
name: iOS browser rotation touch layers
description: Replit’s iOS in-app browser can retain stale visual and touch layers after an orientation change.
---

After portrait-to-landscape rotation in Replit’s iOS browser, buttons can look correctly positioned while their touch regions remain at the old coordinates. Pressing the stale location may briefly reveal a duplicate ghost copy of the button. A forced reflow, visibility toggle, and compositor repaint may not clear it.

**Why:** The issue was captured in a screenshot showing one button at its visible location and a second pressed-state copy at the stale touch location. A full-root repaint was tried and explicitly confirmed ineffective. The final repair was confirmed working in the Replit iOS browser only after removing User-Agent and touch-capability guards.

**How to apply:** Treat this as a stale WebKit route subtree rather than an ordinary overlay or CSS pointer-events bug. Do not gate the repair on User-Agent strings or touch-capability values because Replit's embedded browser may report them unexpectedly. Listen to explicit orientation signals plus layout and visual-viewport resize signals, wait for rotation to settle, then remount only the affected interactive page subtree. Keep authentication, global providers, query cache, and background wrapper outside the remount boundary.