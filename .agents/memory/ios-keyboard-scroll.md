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
5. **Do not use sticky or absolute action rows inside these scrollable dialogs.** iOS can move them over earlier form sections when the keyboard changes the viewport.
6. If actions must remain visible, use a three-row dialog grid: header, `minmax(0, 1fr)` scrollable form, and a normal-flow footer row. Link its submit button with the form attribute.
7. In dense editor dialogs, hide the normal-flow footer while an input or textarea has focus. The user confirmed this gives the focused field enough room on iOS; the footer returns when the keyboard is dismissed and the field blurs.

**Why:** CSS class selectors (`closest(".overflow-y-auto")`) can miss the target in WKWebView. Double-subtracting keyboard height (once via `innerHeight` shrink, once via hardcoded 350px) causes over-scrolling on regular browsers. Sticky form actions visibly jump and overlap content when iOS opens the keyboard.

**How to apply:** Any dialog with inputs that get covered by the keyboard on iOS. Keep actions in a normal three-row grid, and hide the footer during text focus when the keyboard leaves too little usable height.
