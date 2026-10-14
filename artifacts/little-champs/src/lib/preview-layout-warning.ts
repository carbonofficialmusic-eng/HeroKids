const resizeObserverMessages = new Set([
  "ResizeObserver loop completed with undelivered notifications.",
  "ResizeObserver loop limit exceeded",
]);

/**
 * ResizeObserver defers excess layout notifications until the next frame.
 * Browsers report that notification without an Error object; the preview
 * overlay otherwise converts it into an opaque, blocking runtime error.
 * Only install in development. Actual exceptions must reach the overlay.
 */
export function installPreviewLayoutWarningFilter(target: Window): () => void {
  let reported = false;
  const onError = (event: ErrorEvent) => {
    if (event.error != null || !resizeObserverMessages.has(event.message)) return;
    if (!reported) {
      console.warn(`[Preview layout warning] ${event.message}`);
      reported = true;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  target.addEventListener("error", onError, true);
  return () => target.removeEventListener("error", onError, true);
}
