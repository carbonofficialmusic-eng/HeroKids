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
 * Window-backed flag set whenever the user selects a photo (native camera or
 * file input). The dashboard mutations read this in onSuccess to decide
 * whether a full-page navigation is needed to fix WKWebView GPU displacement.
 * Using a window property avoids ES-module live-binding caveats.
 */
export function markPhotoUsed(): void {
  (window as any).__herokidsPhotoUsed = true;
}
export function clearPhotoUsed(): void {
  (window as any).__herokidsPhotoUsed = false;
}
export function isPhotoUsed(): boolean {
  return !!(window as any).__herokidsPhotoUsed;
}

/**
 * Forces WKWebView to re-sync its UIScrollView after a native photo picker
 * closes (supplementary best-effort attempt alongside the page navigation).
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

/**
 * Forces the sticky/fixed header to repaint after a native camera dismiss.
 * On iOS WKWebView, closing the native camera picker does NOT trigger
 * visibilitychange or resume events — the app never leaves foreground.
 * WKWebView's compositor may keep a stale cached layer for position:sticky
 * elements. Briefly toggling opacity forces a fresh composite pass.
 */
export function kickHeaderRepaint(): void {
  const repaint = () => {
    const header = document.querySelector("header");
    if (!header) return;
    const h = header as HTMLElement;
    h.style.opacity = "0.9999";
    requestAnimationFrame(() => {
      h.style.opacity = "";
      // Also force a reflow
      void document.documentElement.getBoundingClientRect();
      window.dispatchEvent(new Event("resize"));
    });
  };
  // Immediate
  repaint();
  // At 200ms — camera dismiss animation may still be in progress
  setTimeout(repaint, 200);
  // At 500ms — final compositor settle
  setTimeout(repaint, 500);
  // At 900ms — last resort
  setTimeout(repaint, 900);
}
