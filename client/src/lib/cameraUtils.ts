/**
 * Returns true when the error thrown by the Capacitor Camera plugin represents
 * the user dismissing the photo picker without making a selection.
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
 * Forces WKWebView to re-sync its UIScrollView after a native photo picker
 * (camera or file input) closes. The picker dismissal does not fire a
 * visualViewport resize event, so the global rAF loop cannot detect it.
 * Applying a 1→0 scroll "kick" after the picker closes forces the UIScrollView
 * to process the reset even when WKWebView falsely reports scrollY = 0.
 */
export function kickScrollReset(delayMs = 150): void {
  const apply = () => {
    const root = document.getElementById("root");
    const savedTop = root ? root.scrollTop : 0;
    window.scrollTo(0, 1);
    if (root) root.scrollTop = savedTop;
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (root) root.scrollTop = savedTop;
    });
  };
  if (delayMs > 0) setTimeout(apply, delayMs);
  else apply();
}
