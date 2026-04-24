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
 * Forces WKWebView to re-sync its native rendering layer with the JS scroll state.
 *
 * After the iOS camera/photo-picker dismisses, WKWebView's GPU compositing layer
 * can end up visually offset from the correct scroll position. JavaScript still
 * sees the correct scrollTop/scrollY values (so click areas are right), but the
 * visual rendering is displaced. "Tickling" the scroll properties in the next
 * animation frame forces the native UIScrollView to flush its pending offset and
 * re-draw at the correct position.
 */
export function syncScrollAfterCamera(): void {
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    const root = document.getElementById("root");
    if (root) {
      const saved = root.scrollTop;
      root.scrollTop = saved === 0 ? 1 : saved - 1;
      root.scrollTop = saved;
    }
  });
}
