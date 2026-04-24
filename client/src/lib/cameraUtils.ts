/**
 * Returns true when the error thrown by the Capacitor Camera plugin represents
 * the user dismissing the photo picker without making a selection.
 *
 * Known cancellation messages by platform:
 *   iOS   – "User cancelled photos app", "User cancelled"
 *   Android – "User cancelled photos app", "No image picked" (picker dismissed),
 *             "dismissed" (some Android picker close events)
 */
export function isPhotoPickerCancelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("cancel") ||
    msg.includes("no image picked") ||
    msg.includes("dismissed")
  );
}

/**
 * Called immediately after Camera.getPhoto() resolves on iOS.
 *
 * After the native camera picker dismisses, WKWebView's GPU compositing layer
 * can become desynced from the DOM layout — the visual content appears shifted
 * downward while click areas remain at the correct positions.
 *
 * Two sync mechanisms are used:
 *
 * 1. CSS-scroll nudge (root.scrollTop ± 1):
 *    Changing the CSS scroll container's scrollTop forces WKWebView to submit
 *    new GPU tiles at the correct position. We nudge by +1px then restore in
 *    the next animation frame — the user sees at most one 1px scroll frame.
 *
 * 2. Window scroll pulse (scrollTo 0,1 → 0,0):
 *    Flushes any UIScrollView contentInset.top that iOS may have set during
 *    the camera overlay, which can leave window.scrollY reading as non-zero
 *    even when the visual content looks correct.
 *
 * Both run at t=350ms and t=700ms after camera resolve to cover the full
 * dismiss-animation window (~300ms on iOS).
 */
export function syncScrollAfterCamera(): void {
  const fix = () => {
    const root = document.getElementById('root');
    if (!root) return;
    const saved = root.scrollTop;

    // --- 1. window scroll pulse ---
    window.scrollTo(0, 1);
    window.scrollTo(0, 0);
    if (root.scrollTop !== saved) root.scrollTop = saved;

    // --- 2. CSS-scroll nudge across two frames ---
    const t = root.scrollTop;
    root.scrollTop = t + 1;
    requestAnimationFrame(() => {
      root.scrollTop = t;
    });
  };

  // Delay until after the native dismiss animation (~300ms).
  setTimeout(fix, 350);
  setTimeout(fix, 700);
}
