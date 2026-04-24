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
 * After the native camera picker dismisses, WKWebView may have a non-zero
 * window.scrollY due to UIScrollView contentInset adjustments made by iOS
 * during the camera overlay. A brief scroll pulse (to 1 then back to 0)
 * nudges WKWebView to flush the contentInset so the visual rendering
 * re-aligns with the DOM layout.
 *
 * #root.scrollTop is saved before the pulse and restored immediately if
 * window.scrollTo had a side-effect on it (known WKWebView behaviour on
 * some iOS versions).
 */
export function syncScrollAfterCamera(): void {
  const pulse = () => {
    const root = document.getElementById('root');
    if (!root) return;
    const savedTop = root.scrollTop;
    window.scrollTo(0, 1);
    window.scrollTo(0, 0);
    if (root.scrollTop !== savedTop) root.scrollTop = savedTop;
  };
  pulse();
  setTimeout(pulse, 300);
}
