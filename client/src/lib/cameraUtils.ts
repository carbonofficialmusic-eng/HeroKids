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
 * Refreshes the frozen --sat CSS variable from the live env(safe-area-inset-top).
 * Called after camera dismiss and app resume so the header height stays correct
 * even if WKWebView briefly reported a stale value during the transition.
 */
function refreshSat(): void {
  const div = document.createElement("div");
  div.style.cssText =
    "position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:0;visibility:hidden;pointer-events:none";
  document.documentElement.appendChild(div);
  const px = parseFloat(getComputedStyle(div).height) || 0;
  document.documentElement.removeChild(div);
  document.documentElement.style.setProperty("--sat", `${px}px`);
}

/**
 * Full WKWebView recovery kick after a native camera dismiss.
 *
 * Closing the native camera picker does NOT fire visibilitychange or resume
 * events, so App.tsx's doResumeKick never runs. This function replicates the
 * same sequence:
 *  1. Refresh --sat so the frozen safe-area value is up-to-date.
 *  2. Horizontal 1→0 scroll kick to force UIScrollView X-axis reset.
 *  3. Save/restore #root.scrollTop so vertical scroll isn't lost.
 *  4. Synthetic resize so hooks re-read window dimensions.
 *  5. Synchronous reflow (getBoundingClientRect) to flush stale layout.
 *  6. Opacity toggle on <header> to force GPU compositor re-composite.
 *
 * Fired immediately and at 200 / 500 / 900 ms to cover the full camera
 * dismiss animation window.
 */
export function kickHeaderRepaint(): void {
  const kick = () => {
    const root = document.getElementById("root");
    const savedTop = root ? root.scrollTop : 0;

    // 1. Re-freeze safe-area value
    refreshSat();

    // 2+3. Horizontal kick + restore vertical scroll
    window.scrollTo(1, 0);
    window.scrollTo(0, 0);
    if (root && root.scrollTop !== savedTop) root.scrollTop = savedTop;

    // 4. Synthetic resize
    window.dispatchEvent(new Event("resize"));

    // 5. Synchronous reflow
    void document.documentElement.getBoundingClientRect();

    // 6. Header opacity toggle
    const header = document.querySelector("header");
    if (header) {
      const h = header as HTMLElement;
      h.style.opacity = "0.9999";
      requestAnimationFrame(() => {
        h.style.opacity = "";
        if (root && root.scrollTop !== savedTop) root.scrollTop = savedTop;
      });
    }
  };

  kick();
  setTimeout(kick, 200);
  setTimeout(kick, 500);
  setTimeout(kick, 900);
}
