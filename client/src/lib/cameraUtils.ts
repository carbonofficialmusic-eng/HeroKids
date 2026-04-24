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
 * Force WKWebView to re-sync its GPU compositing layer and flush any
 * contentInset.top that iOS set during native camera overlay.
 *
 * Mechanism:
 *  1. Save #root.scrollTop (protected through the whole sequence).
 *  2. Apply transform:translateZ(0) — promotes element to its own GPU layer
 *     at the CORRECT position, overwriting any stale compositing offset.
 *  3. Scroll-pulse: window.scrollTo(0,1) → window.scrollTo(0,0) flushes
 *     WKWebView's UIScrollView contentInset.top so it no longer shifts the
 *     visual content down after the native picker dismisses.
 *  4. Restore #root.scrollTop if the scroll-pulse had a side-effect on it.
 *  5. Remove the transform in the next rAF frame (layout stays correct, GPU
 *     is now synced and keeps the corrected position).
 *
 * Called multiple times at increasing delays to cover the full camera-dismiss
 * animation window (~450 ms on iOS).
 */
function forceWKWebViewSync(): void {
  const root = document.getElementById('root');
  if (!root) return;
  const savedTop = root.scrollTop;

  root.style.setProperty('-webkit-transform', 'translateZ(0)');
  root.style.setProperty('transform', 'translateZ(0)');

  window.scrollTo(0, 1);
  window.scrollTo(0, 0);
  if (root.scrollTop !== savedTop) root.scrollTop = savedTop;

  requestAnimationFrame(() => {
    root.style.removeProperty('-webkit-transform');
    root.style.removeProperty('transform');
    if (root.scrollTop !== savedTop) root.scrollTop = savedTop;
  });
}

export function syncScrollAfterCamera(): void {
  forceWKWebViewSync();
  setTimeout(forceWKWebViewSync, 200);
  setTimeout(forceWKWebViewSync, 450);
}
