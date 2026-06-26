---
name: iOS Keyboard Scroll Fix for Dialogs
description: How to reliably scroll dialog fields into view when the keyboard appears, across WKWebView and regular browsers.
---

## Rule
To scroll a focused input above the iOS keyboard inside a scrollable dialog:

1. **Find scrollable ancestor** via `getComputedStyle(parent).overflowY === "auto"` — NOT via CSS class names (`.overflow-y-auto` matching is unreliable).
2. **Add `paddingBottom = keyboardHeight` on focus** so the content can always scroll far enough; remove it on `blur` via a `{ once: true }` event listener.
3. **Detect visible bottom correctly**:
   - Regular browsers (Chrome, Replit preview): `visualViewport.height` shrinks when keyboard opens → use `vvHeight` directly as the visible bottom.
   - iOS WKWebView (Capacitor): `visualViewport.height` does NOT shrink → use `innerHeight - 350` (fixed estimate).
   - Detection: `vvHeight < innerHeight - 50 ? vvHeight : innerHeight - KEYBOARD_HEIGHT`
4. **Scroll timing**: wait ~400ms after `onFocus` (keyboard animation completes), then `scrollBy`.

**Why:** CSS class selectors (`closest(".overflow-y-auto")`) can miss the target in WKWebView. Double-subtracting keyboard height (once via `innerHeight` shrink, once via hardcoded 350px) causes over-scrolling on regular browsers.

**How to apply:** Any dialog with inputs that get covered by the keyboard on iOS. See `reward-dialog.tsx` `scrollFieldIntoView()` for the working implementation.
