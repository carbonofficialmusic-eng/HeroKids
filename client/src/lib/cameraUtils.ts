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
 * Forces WKWebView to reset its UIScrollView contentInset after the iOS
 * camera/photo-picker dismisses.
 *
 * Background: iOS presents the native camera as a view controller on top of
 * WKWebView. When it dismisses, WKWebView can end up with a stale
 * contentInset.top on its underlying UIScrollView. This makes a large
 * non-scrollable gap appear at the top of the page even though JS-level
 * scrollTop is 0. The fix is to scroll the *window* (not #root) to a
 * non-zero position and immediately back — this forces WKWebView to
 * recalculate and flush the contentInset.
 *
 * We repeat the reset at 0 ms, 150 ms, 400 ms, and 700 ms to cover the
 * entire camera dismiss animation timeline.
 */
export function syncScrollAfterCamera(): void {
  function resetWindowScroll() {
    // Momentarily scroll to 1 then back to 0 — this is the canonical iOS trick
    // to force WKWebView UIScrollView to flush a stale contentInset.top.
    window.scrollTo(0, 1);
    window.scrollTo(0, 0);
    // Belt-and-suspenders: also reset via documentElement and body
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  // Immediate (covers the case where camera dismiss already finished)
  requestAnimationFrame(resetWindowScroll);
  // Mid-animation (dismiss animation is ~300ms on most iPhones)
  setTimeout(resetWindowScroll, 150);
  // Post-animation (cover slower devices / longer transitions)
  setTimeout(resetWindowScroll, 400);
  // Final safeguard
  setTimeout(resetWindowScroll, 700);
}
