---
name: iOS Keyboard Scroll Fix for Dialogs
description: How to reliably scroll dialog fields into view when the keyboard appears, across WKWebView and regular browsers.
---

## Rule
To scroll a focused input above the iOS keyboard inside a scrollable dialog:

1. **Find scrollable ancestor** via `getComputedStyle(parent).overflowY === "auto"` — NOT via CSS class names (`.overflow-y-auto` matching is unreliable).
2. **Add `paddingBottom = keyboardHeight` on focus** so the content can always scroll far enough; remove it on `blur` via a `{ once: true }` event listener.
   - Apply this only on coarse-pointer devices that may open a software keyboard. A narrow viewport alone is not sufficient: Replit's desktop browser can be narrow while still using mouse and hardware keyboard, and would otherwise gain a false 350px blank area.
   - In mobile browsers where `visualViewport` expands again when the keyboard closes, remove the padding on that viewport resize as well; focus can remain on the input after keyboard dismissal.
3. **Detect visible bottom correctly**:
   - Regular browsers (Chrome, Replit preview): `visualViewport.height` shrinks when keyboard opens → use `vvHeight` directly as the visible bottom.
   - iOS WKWebView (Capacitor): `visualViewport.height` does NOT shrink → use `innerHeight - 350` (fixed estimate).
   - Detection: `vvHeight < innerHeight - 50 ? vvHeight : innerHeight - KEYBOARD_HEIGHT`
4. **Scroll timing**: wait ~400ms after `onFocus` (keyboard animation completes), then `scrollBy`.
5. **Do not use sticky or absolute action rows inside these scrollable dialogs.** iOS can move them over earlier form sections when the keyboard changes the viewport.
6. If actions must remain visible, use a three-row dialog grid: header, `minmax(0, 1fr)` scrollable form, and a normal-flow footer row. Link its submit button with the form attribute.
7. In dense editor dialogs, hide the normal-flow footer and large pre-input selectors/previews while an input or textarea has focus. This leaves the reduced keyboard viewport for the active fields; hidden sections return on blur.
8. For controlled editor dialogs in iOS browsers, prevent Radix `pointerDownOutside` and `interactOutside` dismissal. Keyboard-driven viewport movement can otherwise be interpreted as an outside interaction and close the editor during text focus.
9. After preventing keyboard resize from remounting the route, a delayed focus correction may scroll the dialog's inner form only. Compute the field offset from form and field rectangles; never use window scrolling or `scrollIntoView`, which can move the whole page. Preserve footer geometry with `visibility: hidden`, and block implicit Enter submission when saving must be explicit.
10. Never infer device rotation from `innerWidth > innerHeight` after a height-only resize. The iOS keyboard can make a portrait viewport satisfy that condition. Any rotation-triggered route remount must require a substantial width change or an explicit orientation event.

**Why:** CSS class selectors (`closest(".overflow-y-auto")`) can miss the target in WKWebView. Unconditionally adding a mobile keyboard reserve creates a large blank area in desktop dialogs. Double-subtracting keyboard height (once via `innerHeight` shrink, once via hardcoded 350px) causes over-scrolling on regular browsers. Sticky form actions visibly jump and overlap content when iOS opens the keyboard. Viewport movement may also create a false outside interaction in Radix. Removing a footer from layout changes dialog height during focus; implicit mobile Enter can also submit and close an editor unexpectedly. Treating the keyboard's height reduction as rotation remounts the route, destroys dialog state, and makes the editor close.

The user confirmed the combined behavior works in Replit's iOS browser: keyboard height changes do not remount the dashboard, large pre-input content collapses during focus, and the inner form scrolls the active field into view.

**How to apply:** Any dialog with inputs that get covered by the keyboard on iOS. Keep actions in a normal three-row grid, and hide the footer during text focus when the keyboard leaves too little usable height.
