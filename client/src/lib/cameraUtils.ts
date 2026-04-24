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
 * Module-level flag: set true after a native camera session, cleared when the
 * surrounding dialog closes.  The dashboard's dialog-close handler checks this
 * flag to decide whether to trigger a silent remount that fixes WKWebView's
 * GPU compositing layer desync (the same effect that a profile switch achieves).
 */
export let cameraWasUsed = false;

export function markCameraUsed(): void {
  cameraWasUsed = true;
}

export function clearCameraUsed(): void {
  cameraWasUsed = false;
}

/**
 * No-op kept for call-site compatibility.  The remount mechanism in the
 * dashboard handles the WKWebView displacement fix.
 */
export function syncScrollAfterCamera(): void {}
