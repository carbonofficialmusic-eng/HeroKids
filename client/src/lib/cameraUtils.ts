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
 * Timestamp (ms) until which the App.tsx rAF scroll-enforcement loop should
 * skip its window.scrollTo(0,0) calls.
 *
 * Background: after the iOS native camera/photo-picker dismisses, WKWebView
 * temporarily applies a non-zero contentInset.top to its UIScrollView.  While
 * this inset is active, window.scrollY reads as non-zero, which causes the
 * enforcement loop to fire window.scrollTo(0,0) on every animation frame.
 * On some WKWebView versions those calls are routed through to #root.scrollTop,
 * making the page appear non-scrollable for as long as the inset persists.
 *
 * By pausing the loop for ~1 second we let WKWebView resolve the inset
 * on its own, then resume normal enforcement afterwards.
 */
export let cameraRecoveryUntil = 0;

/**
 * Call this immediately after the Capacitor Camera plugin returns a photo.
 * Suppresses the window-scroll enforcement loop for 1 second so that
 * WKWebView can reset its UIScrollView contentInset without interference.
 */
export function syncScrollAfterCamera(): void {
  cameraRecoveryUntil = Date.now() + 1000;
}
